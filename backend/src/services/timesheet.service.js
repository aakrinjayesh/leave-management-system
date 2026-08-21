const prisma = require("../config/prisma");
const { buildCsv, slugify } = require("../utils/csv.util");
const leaveCalendarService = require("./leaveCalendar.service");

const startOfUtcDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// Monday of the week containing `date` (Monday-Sunday weeks).
const getWeekStart = (date) => {
  const day = startOfUtcDay(date);
  const dayOfWeek = day.getUTCDay(); // 0 = Sunday ... 6 = Saturday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(day);
  monday.setUTCDate(monday.getUTCDate() + diffToMonday);
  return monday;
};

const getWeekEnd = (weekStart) => {
  const sunday = new Date(weekStart);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return sunday;
};

// Computes the [start, end] date range a manager/admin view request is
// asking about, given a view mode (day/week/month) and an anchor date.
const getViewRange = (view, anchorDate) => {
  const anchor = startOfUtcDay(anchorDate);

  if (view === "day") {
    return { start: anchor, end: anchor };
  }

  if (view === "month") {
    const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
    return { start, end };
  }

  // default: week
  const start = getWeekStart(anchor);
  const end = getWeekEnd(start);
  return { start, end };
};

// Submitted (locked) entries only - draft/in-progress entries aren't visible
// to a manager or admin until the employee submits the week. Scoped to one
// project when given - an employee assigned to several projects has a
// separate, independent set of entries for each, so viewing "their
// timesheet" always means one specific project's, never all of them merged.
const getSubmittedEntriesInRange = (userId, start, end, projectId) =>
  prisma.timesheetEntry.findMany({
    where: {
      userId,
      timesheetSubmissionId: { not: null },
      date: { gte: start, lte: end },
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { date: "asc" },
  });

const sumHours = (entries) => entries.reduce((sum, entry) => sum + entry.hoursWorked, 0);

// Submissions (weekly bundles) whose week overlaps the viewed [start, end]
// range at all - used to surface each week's uploaded attachment alongside
// the day/week/month entries breakdown. Scoped to one project when given,
// same reasoning as getSubmittedEntriesInRange above.
const getSubmissionsOverlappingRange = (userId, start, end, projectId) =>
  prisma.timesheetSubmission.findMany({
    where: {
      userId,
      weekStartDate: { lte: end },
      weekEndDate: { gte: start },
      ...(projectId ? { projectId } : {}),
    },
    select: {
      id: true,
      weekStartDate: true,
      weekEndDate: true,
      attachmentOriginalName: true,
      projectAssigned: true,
      project: { select: { name: true } },
    },
    orderBy: { weekStartDate: "asc" },
  });

// Every distinct employee who has logged a timesheet week against this
// project, most-recently-active first - shown as a hint in the admin's Edit
// Project modal ("recently logged time on this project: ...") for projects
// that had submissions before admin-assigned membership existed, so admin
// can decide whether to formally add them as members.
const getRecentProjectMembers = async (projectId) => {
  const submissions = await prisma.timesheetSubmission.findMany({
    where: { projectId },
    orderBy: { weekStartDate: "desc" },
    select: { userId: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });

  const seen = new Map();
  for (const submission of submissions) {
    if (!seen.has(submission.userId)) seen.set(submission.userId, submission.user);
  }
  return [...seen.values()];
};

const toDateKey = (date) => new Date(date).toISOString().slice(0, 10);

// Detailed per-employee CSV: one row per entry plus a totals row - exactly
// the same data shown on the day/week/month breakdown screen.
const buildEmployeeTimesheetCsv = ({ employee, view, rangeStart, rangeEnd, entries, totalHours }) => {
  const rows = entries.map((entry) => [toDateKey(entry.date), entry.hoursWorked, entry.description]);
  rows.push(["Total", totalHours, ""]);

  const csv = buildCsv(["Date", "Hours", "Description"], rows);
  const filename = `${slugify(`${employee.firstName}-${employee.lastName}`)}-timesheet-${view}-${toDateKey(rangeStart)}-to-${toDateKey(rangeEnd)}.csv`;

  return { csv, filename };
};

// Company-wide payroll CSV: one row per active non-admin employee with their
// total submitted hours for the given month.
const buildPayrollCsv = async (monthStart, monthEnd) => {
  const employees = await prisma.user.findMany({
    where: { status: "ACTIVE", userType: { in: ["EMPLOYEE", "MANAGER"] } },
    orderBy: { firstName: "asc" },
  });

  const rows = [];
  let grandTotal = 0;

  for (const employee of employees) {
    const entries = await getSubmittedEntriesInRange(employee.id, monthStart, monthEnd);
    const total = sumHours(entries);
    grandTotal += total;
    rows.push([`${employee.firstName} ${employee.lastName}`, employee.email, total]);
  }

  rows.push(["Total", "", grandTotal]);

  const csv = buildCsv(["Employee Name", "Email", "Total Hours"], rows);
  const monthLabel = toDateKey(monthStart).slice(0, 7);
  const filename = `payroll-timesheet-${monthLabel}.csv`;

  return { csv, filename };
};

// Collapses a user's submissions (must already be sorted ascending by
// weekStartDate) into one row per consecutive run on the same project, most
// recent stint first - e.g. weeks on "Aakrin LMS" then weeks on "XYZ"
// becomes [{ project: XYZ, since: ... }, { project: Aakrin LMS, since: ... }]
// instead of one row per week.
const buildProjectStints = (submissions) => {
  const stints = [];
  for (const submission of submissions) {
    const last = stints[stints.length - 1];
    if (last && last.projectId === submission.projectId) {
      last.endDate = submission.weekEndDate;
    } else {
      stints.push({
        projectId: submission.projectId,
        projectName: submission.project?.name ?? null,
        startDate: submission.weekStartDate,
        endDate: submission.weekEndDate,
      });
    }
  }
  return stints.reverse();
};

// Census for the admin Report tab: every active Employee/Manager, one row
// per project they're actually assigned to (an employee on 2 projects shows
// up twice, once per project) - "Since" is the real ProjectMembership.assignedAt
// date. Anyone with no formal membership yet falls back to timesheet
// submission history as a hint (same purpose as before this was
// admin-assignable), and falls into notAssigned if neither exists.
const getProjectAssignmentReport = async () => {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", userType: { in: ["EMPLOYEE", "MANAGER"] } },
    orderBy: { firstName: "asc" },
    include: {
      projectMemberships: {
        include: { project: { select: { id: true, name: true, projectType: true } } },
        orderBy: { assignedAt: "desc" },
      },
    },
  });

  const usersWithoutMembership = users.filter((u) => u.projectMemberships.length === 0);

  // Full history (not just the latest row) so a fallback project's start
  // date can be derived from where its run of consecutive weeks began.
  const allSubmissions = await prisma.timesheetSubmission.findMany({
    where: { userId: { in: usersWithoutMembership.map((u) => u.id) }, projectAssigned: { not: null } },
    orderBy: { weekStartDate: "asc" },
    select: {
      userId: true,
      projectAssigned: true,
      projectId: true,
      weekStartDate: true,
      weekEndDate: true,
      project: { select: { name: true } },
    },
  });

  const submissionsByUserId = new Map();
  for (const submission of allSubmissions) {
    if (!submissionsByUserId.has(submission.userId)) submissionsByUserId.set(submission.userId, []);
    submissionsByUserId.get(submission.userId).push(submission);
  }

  const assigned = [];
  const notAssigned = [];

  for (const user of users) {
    const baseEntry = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      employeeCode: user.employeeCode,
      email: user.email,
      managerId: user.managerId,
    };

    if (user.projectMemberships.length > 0) {
      for (const membership of user.projectMemberships) {
        const entry = {
          ...baseEntry,
          projectId: membership.project.id,
          projectName: membership.project.name,
          projectSince: membership.assignedAt,
        };
        (membership.project.projectType === "ASSIGNED" ? assigned : notAssigned).push(entry);
      }
      continue;
    }

    // No formal membership - fall back to timesheet history as a hint.
    const submissions = submissionsByUserId.get(user.id) ?? [];
    const [current] = buildProjectStints(submissions);
    const latestSubmission = submissions[submissions.length - 1];
    const entry = {
      ...baseEntry,
      projectId: current?.projectId ?? null,
      projectName: current?.projectName ?? null,
      // Only ever a real date once they've actually submitted a week under
      // it - no membership and no submissions yet means there's no "since".
      projectSince: current?.startDate ?? null,
    };
    (latestSubmission?.projectAssigned === "ASSIGNED" ? assigned : notAssigned).push(entry);
  }

  return {
    totalEmployees: users.length,
    assignedCount: assigned.length,
    notAssignedCount: notAssigned.length,
    assigned,
    notAssigned,
  };
};

// Full project timeline for one employee, most recent stint first - powers
// the admin "View history" popup.
const getProjectHistoryForUser = async (userId) => {
  const submissions = await prisma.timesheetSubmission.findMany({
    where: { userId, projectId: { not: null } },
    orderBy: { weekStartDate: "asc" },
    select: { projectId: true, weekStartDate: true, weekEndDate: true, project: { select: { name: true } } },
  });

  return buildProjectStints(submissions).map((stint, index) => ({ ...stint, isCurrent: index === 0 }));
};

const DEFAULT_HOURS_PER_DAY = 8;

// Hours in a single working day for whichever project this week's
// submission was against - falls back to the standard 8h day if there's no
// submission yet this week (so no project to read hours from either).
const getHoursPerDay = (project) => {
  if (!project?.workStartTime || !project?.workEndTime) return DEFAULT_HOURS_PER_DAY;
  const [startHour, startMinute] = project.workStartTime.split(":").map(Number);
  const [endHour, endMinute] = project.workEndTime.split(":").map(Number);
  const hours = endHour + endMinute / 60 - (startHour + startMinute / 60);
  return hours > 0 ? hours : DEFAULT_HOURS_PER_DAY;
};

// How many of an employee's APPROVED leave days actually fall within
// [weekStartDate, weekEndDate]. A leave request's own totalDays already
// excludes weekends/holidays (see leaveCalendar.service's computeWorkingDays),
// but the request itself can span outside the requested week partially or
// entirely, so totalDays can't just be summed as-is.
const getApprovedLeaveDaysInWeek = async (userId, weekStartDate, weekEndDate, weekendPolicies, holidayDateKeys) => {
  const requests = await prisma.leaveRequest.findMany({
    where: {
      userId,
      status: "APPROVED",
      startDate: { lte: weekEndDate },
      endDate: { gte: weekStartDate },
    },
    select: { startDate: true, endDate: true, totalDays: true },
  });

  let total = 0;
  for (const request of requests) {
    const fullyWithinWeek = request.startDate >= weekStartDate && request.endDate <= weekEndDate;
    if (fullyWithinWeek) {
      total += request.totalDays;
      continue;
    }
    // Spans outside this week - recount just the overlapping days using the
    // same weekend/holiday exclusion rules totalDays was originally computed with.
    const overlapStart = request.startDate < weekStartDate ? weekStartDate : request.startDate;
    const overlapEnd = request.endDate > weekEndDate ? weekEndDate : request.endDate;
    for (const date of leaveCalendarService.eachDate(overlapStart, overlapEnd)) {
      if (leaveCalendarService.isWeekendDate(date, weekendPolicies)) continue;
      if (holidayDateKeys.has(leaveCalendarService.toDateKey(date))) continue;
      total += 1;
    }
  }
  return total;
};

// Weekly workload for the admin Report screen, split into two pieces since
// an employee can now be on several projects at once:
//  - byUserId: how many days this week were even working days (weekends
//    aside), how many were eaten by a mandatory holiday or the employee's
//    own approved leave, and what that leaves as billable - genuinely
//    per-employee facts (a leave day is a leave day regardless of which
//    project row is being looked at), so every project row for the same
//    employee shares the same figures here.
//  - byUserProject: the hours actually submitted that week, and the
//    working-hours-per-day used to compute them - both come from a specific
//    project's own submission, so an employee with 2 projects (and 2
//    separate submissions, possibly with different working hours) gets a
//    separate entry per (user, project) pair here instead of one shared number.
const getWeeklyWorkloadReport = async (weekStartDate, weekEndDate) => {
  const [users, weekendPolicies, holidays, submissions] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE", userType: { in: ["EMPLOYEE", "MANAGER"] } },
      select: { id: true },
    }),
    leaveCalendarService.getWeekendPolicies(),
    leaveCalendarService.getHolidaysInRange(weekStartDate, weekEndDate),
    prisma.timesheetSubmission.findMany({
      where: { weekStartDate },
      select: {
        userId: true,
        projectId: true,
        totalHours: true,
        project: { select: { workStartTime: true, workEndTime: true } },
      },
    }),
  ]);

  // Only mandatory holidays reduce everyone's working days - an optional one
  // only counts against a specific employee if they actually took it as
  // their own approved leave (handled per-employee below, using the full
  // holiday set so a leave day never double-counts a holiday date).
  const mandatoryHolidayDateKeys = new Set(
    holidays.filter((h) => !h.isOptional).map((h) => leaveCalendarService.toDateKey(h.holidayDate))
  );
  const allHolidayDateKeys = new Set(holidays.map((h) => leaveCalendarService.toDateKey(h.holidayDate)));

  let totalWorkingDays = 0;
  let holidayWorkingDays = 0;
  for (const date of leaveCalendarService.eachDate(weekStartDate, weekEndDate)) {
    if (leaveCalendarService.isWeekendDate(date, weekendPolicies)) continue;
    totalWorkingDays += 1;
    if (mandatoryHolidayDateKeys.has(leaveCalendarService.toDateKey(date))) holidayWorkingDays += 1;
  }

  const byUserIdEntries = await Promise.all(
    users.map(async (user) => {
      const leaveDays = await getApprovedLeaveDaysInWeek(
        user.id,
        weekStartDate,
        weekEndDate,
        weekendPolicies,
        allHolidayDateKeys
      );

      const leavesHolidaysDays = holidayWorkingDays + leaveDays;
      const billableDays = Math.max(0, totalWorkingDays - leavesHolidaysDays);

      return [user.id, { totalWorkingDays, leavesHolidaysDays, billableDays }];
    })
  );

  const byUserProject = {};
  for (const submission of submissions) {
    if (submission.projectId == null) continue;
    const hoursPerDay = getHoursPerDay(submission.project);
    byUserProject[`${submission.userId}-${submission.projectId}`] = {
      totalWorkingHrs: totalWorkingDays * hoursPerDay,
      totalWorkedHrs: submission.totalHours,
      billableHrs: submission.totalHours,
    };
  }

  return { byUserId: Object.fromEntries(byUserIdEntries), byUserProject };
};

module.exports = {
  startOfUtcDay,
  getWeekStart,
  getWeekEnd,
  getViewRange,
  getSubmittedEntriesInRange,
  getSubmissionsOverlappingRange,
  getRecentProjectMembers,
  getProjectAssignmentReport,
  getProjectHistoryForUser,
  getWeeklyWorkloadReport,
  sumHours,
  buildEmployeeTimesheetCsv,
  buildPayrollCsv,
};
