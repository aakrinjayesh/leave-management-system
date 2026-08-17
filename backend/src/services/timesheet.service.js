const prisma = require("../config/prisma");
const { buildCsv, slugify } = require("../utils/csv.util");

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
// to a manager or admin until the employee submits the week.
const getSubmittedEntriesInRange = (userId, start, end) =>
  prisma.timesheetEntry.findMany({
    where: {
      userId,
      timesheetSubmissionId: { not: null },
      date: { gte: start, lte: end },
    },
    orderBy: { date: "asc" },
  });

const sumHours = (entries) => entries.reduce((sum, entry) => sum + entry.hoursWorked, 0);

// Submissions (weekly bundles) whose week overlaps the viewed [start, end]
// range at all - used to surface each week's uploaded attachment alongside
// the day/week/month entries breakdown.
const getSubmissionsOverlappingRange = (userId, start, end) =>
  prisma.timesheetSubmission.findMany({
    where: { userId, weekStartDate: { lte: end }, weekEndDate: { gte: start } },
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

// The employee's most recent submission that has a project-assignment
// choice recorded - used to pre-fill a fresh week's dropdown with whatever
// they picked last time, so they only need to change it when it changes.
const getLastProjectAssigned = async (userId) => {
  const submission = await prisma.timesheetSubmission.findFirst({
    where: { userId, projectAssigned: { not: null } },
    orderBy: { weekStartDate: "desc" },
    select: { projectAssigned: true },
  });
  return submission?.projectAssigned ?? null;
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

// Census for the admin Report tab: every active Employee/Manager, split by
// their latest recorded Project Assigned choice (same "sticky" value used to
// pre-fill the timesheet dropdown) - anyone who's never made a choice yet
// falls into notAssigned, since the point of the report is to surface who
// still needs a look, not to track timesheet-submission completeness.
const getProjectAssignmentReport = async () => {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", userType: { in: ["EMPLOYEE", "MANAGER"] } },
    orderBy: { firstName: "asc" },
  });

  // Full history (not just the latest row) so the current project's start
  // date can be derived from where its run of consecutive weeks began.
  const allSubmissions = await prisma.timesheetSubmission.findMany({
    where: { userId: { in: users.map((u) => u.id) }, projectAssigned: { not: null } },
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

  const toReportEntry = (user) => {
    const submissions = submissionsByUserId.get(user.id) ?? [];
    const [current] = buildProjectStints(submissions);
    const latestSubmission = submissions[submissions.length - 1];
    return {
      entry: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        employeeCode: user.employeeCode,
        email: user.email,
        managerId: user.managerId,
        projectName: current?.projectName ?? null,
        projectSince: current?.startDate ?? null,
      },
      projectAssigned: latestSubmission?.projectAssigned ?? null,
    };
  };

  const assigned = [];
  const notAssigned = [];
  for (const user of users) {
    const { entry, projectAssigned } = toReportEntry(user);
    (projectAssigned === "ASSIGNED" ? assigned : notAssigned).push(entry);
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

module.exports = {
  startOfUtcDay,
  getWeekStart,
  getWeekEnd,
  getViewRange,
  getSubmittedEntriesInRange,
  getSubmissionsOverlappingRange,
  getLastProjectAssigned,
  getProjectAssignmentReport,
  getProjectHistoryForUser,
  sumHours,
  buildEmployeeTimesheetCsv,
  buildPayrollCsv,
};
