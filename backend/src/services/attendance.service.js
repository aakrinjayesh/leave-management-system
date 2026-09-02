const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const companySettingsService = require("./companySettings.service");
const leaveCalendarService = require("./leaveCalendar.service");

// ---------------------------------------------------------------------------
// Attendance is a self-reported, per-project daily log. An employee on N
// projects has N mark controls each day: "Present" or "Half day". There's no
// approval step and no late/on-time judgement.
//
// The employee can mark or change any working day from the tracking start
// (see TRACKING_START) or their joining date, whichever is later, right up to
// today - useful when they forget. Days before that floor can only be touched
// by an admin.
//
// Weekend / holiday / on-leave / WFH states are NEVER stored: they're derived
// here from WeekendPolicy + Holiday + approved LeaveRequest / WfhRequest, so a
// stored Attendance row always just means "present" (full or half day).
// ---------------------------------------------------------------------------

// Attendance tracking begins here. Days earlier than max(this, joiningDate)
// show as "not tracked" (blank), don't count toward the worked / working-days
// ratio, and can't be self-marked. This is also the earliest day an employee
// can backfill: from this date up to today, every working day is editable.
const TRACKING_START = "2026-08-01";

const STATUS = {
  WEEKEND: "WEEKEND",
  HOLIDAY: "HOLIDAY",
  ON_LEAVE: "ON_LEAVE",
  WFH: "WFH",
  PRESENT: "PRESENT",
  HALF_DAY: "HALF_DAY",
  ABSENT: "ABSENT",
  NOT_MARKED: "NOT_MARKED",
  NOT_TRACKED: "NOT_TRACKED",
  FUTURE: "FUTURE",
};

// Earliest day that counts for a given employee.
const trackingFloorKey = (joiningDate) => {
  const joinKey = joiningDate ? toDateKey(joiningDate) : TRACKING_START;
  return joinKey > TRACKING_START ? joinKey : TRACKING_START;
};

const toDateKey = (date) => new Date(date).toISOString().slice(0, 10);
const dateFromKey = (key) => new Date(`${key}T00:00:00.000Z`);

// Which calendar day it currently is in the company's timezone.
const todayKeyInCompanyTz = (timezone) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};

// Approved leave / WFH overlapping [rangeStart, rangeEnd] for one user, as two
// sets of yyyy-mm-dd keys.
const approvedDayMaps = async (userId, rangeStart, rangeEnd) => {
  const [leaves, wfh] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { userId, status: "APPROVED", startDate: { lte: rangeEnd }, endDate: { gte: rangeStart } },
      select: { startDate: true, endDate: true },
    }),
    prisma.wfhRequest.findMany({
      where: { userId, status: "APPROVED", startDate: { lte: rangeEnd }, endDate: { gte: rangeStart } },
      select: { startDate: true, endDate: true },
    }),
  ]);

  const expand = (rows) => {
    const keys = new Set();
    for (const row of rows) {
      for (const d of leaveCalendarService.eachDate(new Date(row.startDate), new Date(row.endDate))) {
        keys.add(toDateKey(d));
      }
    }
    return keys;
  };

  return { leaveDays: expand(leaves), wfhDays: expand(wfh) };
};

// Display status for one (dayKey, project) pairing. `markRow` is the
// Attendance row for that day/project, or undefined. `floorKey` is the
// earliest day that counts for this employee.
const resolveStatus = ({ dayKey, todayKey, floorKey, weekendSet, holidaySet, leaveDays, wfhDays, markRow }) => {
  // A mark always wins (e.g. an admin-backfilled day before the tracking floor).
  if (markRow) return markRow.isHalfDay ? STATUS.HALF_DAY : STATUS.PRESENT;
  // Weekend / holiday / approved leave / approved WFH still resolve normally
  // even before the tracking floor - they're never something to backfill, so
  // they must stay non-editable and correctly labelled.
  if (weekendSet.has(dayKey)) return STATUS.WEEKEND;
  if (holidaySet.has(dayKey)) return STATUS.HOLIDAY;
  if (leaveDays.has(dayKey)) return STATUS.ON_LEAVE;
  if (wfhDays.has(dayKey)) return STATUS.WFH;
  // Plain working day with no data before the floor - blank, admin-backfillable.
  if (floorKey && dayKey < floorKey) return STATUS.NOT_TRACKED;
  if (dayKey > todayKey) return STATUS.FUTURE;
  if (dayKey === todayKey) return STATUS.NOT_MARKED;
  return STATUS.ABSENT;
};

const tallyStatuses = (statuses) => {
  const counts = { present: 0, halfDay: 0, absent: 0, leave: 0, wfh: 0 };
  for (const s of statuses) {
    if (s === STATUS.PRESENT) counts.present += 1;
    else if (s === STATUS.HALF_DAY) counts.halfDay += 1;
    else if (s === STATUS.ABSENT) counts.absent += 1;
    else if (s === STATUS.ON_LEAVE) counts.leave += 1;
    else if (s === STATUS.WFH) counts.wfh += 1;
  }
  return counts;
};

// Worked days (present + WFH + half-day = 0.5) over the real working days in
// the period. Denominator = every day that ISN'T a weekend / holiday / the
// employee's approved-leave / a future day / before they joined. A completed
// past month therefore counts its full working-day total (e.g. 1/21), while
// the current month counts only working days so far (e.g. 1/1 on the 1st) -
// the caller passes only days up to `min(today, month end)`.
// `cells` = [{ date, status }]. `joinKey` = the employee's joining date key.
const workedRatio = (cells, joinKey) => {
  let worked = 0;
  let workingDays = 0;
  for (const { date, status } of cells) {
    if ([STATUS.WEEKEND, STATUS.HOLIDAY, STATUS.FUTURE, STATUS.ON_LEAVE].includes(status)) continue;
    if (joinKey && date < joinKey) continue; // not employed yet
    workingDays += 1;
    if (status === STATUS.PRESENT || status === STATUS.WFH) worked += 1;
    else if (status === STATUS.HALF_DAY) worked += 0.5;
  }
  return { worked, workingDays };
};

const monthRange = (year, month) => ({
  start: new Date(Date.UTC(year, month - 1, 1)),
  end: new Date(Date.UTC(year, month, 0)),
});

// ------------------------- shared: write one day -------------------------

// A day only accepts an attendance record if it's an actual working day for
// this employee: not a weekend, not a company holiday, not one of their
// approved-leave days. Used by both the employee mark flow and admin correct.
const assertRecordableDay = async (userId, dateKey) => {
  const date = dateFromKey(dateKey);
  const [year, month] = dateKey.split("-").map(Number);
  const [calendar, { leaveDays }] = await Promise.all([
    leaveCalendarService.getMonthCalendarData(year, month),
    approvedDayMaps(userId, date, date),
  ]);
  if (calendar.weekendDates.includes(dateKey)) throw ApiError.badRequest("That day is a weekend.");
  if (calendar.holidays.some((h) => h.date === dateKey)) throw ApiError.badRequest("That day is a company holiday.");
  if (leaveDays.has(dateKey)) throw ApiError.badRequest("The employee is on approved leave that day.");
};

// Present / half-day -> upsert; absent -> delete the row.
const writeDay = async ({ userId, projectId, dateKey, status, isAdmin, adminId, note }) => {
  const date = dateFromKey(dateKey);

  if (status === "ABSENT") {
    await prisma.attendance.deleteMany({ where: { userId, projectId, date } });
    return { cleared: true };
  }

  const isHalfDay = status === "HALF_DAY";
  const base = isAdmin
    ? { source: "ADMIN", note: note || null, correctedById: adminId, correctedAt: new Date() }
    : { source: "SELF" };

  const attendance = await prisma.attendance.upsert({
    where: { userId_projectId_date: { userId, projectId, date } },
    create: { userId, projectId, date, markedAt: new Date(), isHalfDay, ...base },
    update: { isHalfDay, markedAt: new Date(), ...base },
  });
  return { attendance };
};

// ----------------------- employee: mark / change a day -----------------------

const markAttendance = async (userId, projectId, dateKey, status) => {
  if (!["PRESENT", "HALF_DAY", "ABSENT"].includes(status)) {
    throw ApiError.badRequest("Invalid attendance status.");
  }

  const [membership, me] = await Promise.all([
    prisma.projectMembership.findUnique({ where: { userId_projectId: { userId, projectId } } }),
    prisma.user.findUnique({ where: { id: userId }, select: { joiningDate: true } }),
  ]);
  if (!membership) {
    throw ApiError.badRequest("You're not assigned to this project.");
  }

  const { timezone } = await companySettingsService.getSettings();
  const todayKey = todayKeyInCompanyTz(timezone);
  const targetKey = dateKey || todayKey;

  if (targetKey > todayKey) {
    throw ApiError.badRequest("You can't mark attendance for a future date.");
  }
  // Self-marking is open from the tracking floor (max of TRACKING_START and
  // the employee's joining date) up to today. Anything older is admin-only.
  const floorKey = trackingFloorKey(me?.joiningDate);
  if (targetKey < floorKey) {
    if (me?.joiningDate && floorKey === toDateKey(me.joiningDate)) {
      throw ApiError.badRequest("That's before your joining date.");
    }
    throw ApiError.badRequest(
      `You can only mark attendance from ${TRACKING_START} onward. Ask your admin to record anything older.`
    );
  }

  await assertRecordableDay(userId, targetKey);
  return writeDay({ userId, projectId, dateKey: targetKey, status, isAdmin: false });
};

// ------------------------- employee: my attendance -------------------------

const getMyAttendance = async (userId, year, month) => {
  const { timezone } = await companySettingsService.getSettings();
  const todayKey = todayKeyInCompanyTz(timezone);
  const { start, end } = monthRange(year, month);
  const fetchStart = start;

  const [me, projects, calendar, marks, { leaveDays, wfhDays }] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { joiningDate: true } }),
    prisma.project.findMany({
      where: { memberships: { some: { userId } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, workStartTime: true, workEndTime: true },
    }),
    leaveCalendarService.getMonthCalendarData(year, month),
    prisma.attendance.findMany({ where: { userId, date: { gte: fetchStart, lte: end } } }),
    approvedDayMaps(userId, fetchStart, end),
  ]);

  const floorKey = trackingFloorKey(me?.joiningDate); // display: NOT_TRACKED before this
  // Employee can self-mark any working day from the tracking floor up to
  // today - same floor that gates display and the ratio.
  const earliestMarkableKey = floorKey;

  const weekendSet = new Set(calendar.weekendDates);
  const holidaySet = new Set(calendar.holidays.map((h) => h.date));
  const holidayByKey = Object.fromEntries(calendar.holidays.map((h) => [h.date, h.name]));
  const markByKey = new Map(marks.map((m) => [`${m.projectId}|${toDateKey(m.date)}`, m]));

  const dayCell = (dayKey) => {
    const notTracked = dayKey < floorKey;
    const perProject = projects.map((project) => {
      const markRow = markByKey.get(`${project.id}|${dayKey}`);
      return {
        projectId: project.id,
        projectName: project.name,
        status: resolveStatus({ dayKey, todayKey, floorKey, weekendSet, holidaySet, leaveDays, wfhDays, markRow }),
        isHalfDay: markRow?.isHalfDay || false,
        markedAt: markRow?.markedAt || null,
      };
    });

    const statuses = perProject.map((p) => p.status);
    let overall = STATUS.ABSENT;
    if (weekendSet.has(dayKey)) overall = STATUS.WEEKEND;
    else if (holidaySet.has(dayKey)) overall = STATUS.HOLIDAY;
    else if (statuses.includes(STATUS.PRESENT)) overall = STATUS.PRESENT;
    else if (statuses.includes(STATUS.HALF_DAY)) overall = STATUS.HALF_DAY;
    else if (leaveDays.has(dayKey)) overall = STATUS.ON_LEAVE;
    else if (wfhDays.has(dayKey)) overall = STATUS.WFH;
    else if (notTracked) overall = STATUS.NOT_TRACKED;
    else if (dayKey > todayKey) overall = STATUS.FUTURE;
    else if (dayKey === todayKey) overall = STATUS.NOT_MARKED;

    return {
      date: dayKey,
      holidayName: holidayByKey[dayKey] || null,
      isWeekend: weekendSet.has(dayKey),
      isHoliday: holidaySet.has(dayKey),
      notTracked,
      onLeave: leaveDays.has(dayKey),
      onWfh: wfhDays.has(dayKey),
      // The employee can click this day to mark/change it: a working day,
      // on/after their tracking floor, not in the future.
      markable:
        !weekendSet.has(dayKey) &&
        !holidaySet.has(dayKey) &&
        !leaveDays.has(dayKey) &&
        !wfhDays.has(dayKey) &&
        dayKey <= todayKey &&
        dayKey >= earliestMarkableKey,
      overall,
      perProject,
    };
  };

  const daysInMonth = end.getUTCDate();
  const days = [];
  const summaryCells = [];
  for (let d = 1; d <= daysInMonth; d += 1) {
    const dayKey = toDateKey(new Date(Date.UTC(year, month - 1, d)));
    const cell = dayCell(dayKey);
    days.push(cell);
    if (dayKey <= todayKey) summaryCells.push({ date: dayKey, status: cell.overall });
  }
  const joinKey = me?.joiningDate ? toDateKey(me.joiningDate) : null;

  return {
    timezone,
    todayKey,
    backfillStartKey: earliestMarkableKey,
    projects,
    month: { year, month, days },
    summary: {
      ...tallyStatuses(summaryCells.map((c) => c.status)),
      ...workedRatio(summaryCells, joinKey),
    },
  };
};

// --------------------- manager / admin: team + company ---------------------

const getRosterAttendance = async ({ userWhere, year, month }) => {
  const { timezone } = await companySettingsService.getSettings();
  const todayKey = todayKeyInCompanyTz(timezone);
  const { start, end } = monthRange(year, month);

  const [memberships, calendar] = await Promise.all([
    prisma.projectMembership.findMany({
      where: { user: userWhere },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, employeeCode: true, joiningDate: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ user: { firstName: "asc" } }, { project: { name: "asc" } }],
    }),
    leaveCalendarService.getMonthCalendarData(year, month),
  ]);

  const weekendSet = new Set(calendar.weekendDates);
  const holidaySet = new Set(calendar.holidays.map((h) => h.date));

  const userIds = [...new Set(memberships.map((m) => m.userId))];
  const [allMarks, leaveWfhByUser] = await Promise.all([
    prisma.attendance.findMany({ where: { userId: { in: userIds }, date: { gte: start, lte: end } } }),
    Promise.all(userIds.map((id) => approvedDayMaps(id, start, end).then((maps) => [id, maps]))),
  ]);

  const markByKey = new Map(allMarks.map((m) => [`${m.userId}|${m.projectId}|${toDateKey(m.date)}`, m]));
  const contextByUser = new Map(leaveWfhByUser);

  const daysInMonth = end.getUTCDate();
  const dayKeys = [];
  for (let d = 1; d <= daysInMonth; d += 1) {
    dayKeys.push(toDateKey(new Date(Date.UTC(year, month - 1, d))));
  }

  const todaySummary = {
    total: memberships.length,
    present: 0,
    halfDay: 0,
    wfh: 0,
    onLeave: 0,
    notMarked: 0,
    absent: 0,
  };

  const rows = memberships.map((m) => {
    const { leaveDays, wfhDays } = contextByUser.get(m.userId) || { leaveDays: new Set(), wfhDays: new Set() };
    const floorKey = trackingFloorKey(m.user.joiningDate);

    const monthDays = dayKeys.map((dayKey) => {
      const markRow = markByKey.get(`${m.userId}|${m.projectId}|${dayKey}`);
      return {
        date: dayKey,
        status: resolveStatus({ dayKey, todayKey, floorKey, weekendSet, holidaySet, leaveDays, wfhDays, markRow }),
      };
    });

    const todayCell = monthDays.find((d) => d.date === todayKey);
    const todayStatus = todayCell ? todayCell.status : STATUS.FUTURE;
    if (todayStatus === STATUS.PRESENT) todaySummary.present += 1;
    else if (todayStatus === STATUS.HALF_DAY) todaySummary.halfDay += 1;
    else if (todayStatus === STATUS.WFH) todaySummary.wfh += 1;
    else if (todayStatus === STATUS.ON_LEAVE) todaySummary.onLeave += 1;
    else if (todayStatus === STATUS.NOT_MARKED) todaySummary.notMarked += 1;
    else if (todayStatus === STATUS.ABSENT) todaySummary.absent += 1;

    const upToToday = monthDays.filter((d) => d.date <= todayKey);
    const joinKey = m.user.joiningDate ? toDateKey(m.user.joiningDate) : null;

    return {
      userId: m.userId,
      employeeName: `${m.user.firstName} ${m.user.lastName}`,
      employeeCode: m.user.employeeCode,
      projectId: m.projectId,
      projectName: m.project.name,
      today: { date: todayKey, status: todayStatus },
      days: monthDays,
      counts: tallyStatuses(upToToday.map((d) => d.status)),
      ...workedRatio(upToToday, joinKey),
    };
  });

  return {
    timezone,
    todayKey,
    month: { year, month },
    weekendDates: calendar.weekendDates,
    holidays: calendar.holidays,
    todaySummary,
    rows,
  };
};

// --------------------------- admin: correct a day ---------------------------

const correctAttendance = async ({ adminId, userId, projectId, dateKey, action, note }) => {
  const [membership, employee] = await Promise.all([
    prisma.projectMembership.findUnique({ where: { userId_projectId: { userId, projectId } } }),
    prisma.user.findUnique({ where: { id: userId }, select: { joiningDate: true } }),
  ]);
  if (!membership) {
    throw ApiError.badRequest("That employee isn't assigned to this project.");
  }

  const { timezone } = await companySettingsService.getSettings();
  const todayKey = todayKeyInCompanyTz(timezone);
  if (dateKey > todayKey) {
    throw ApiError.badRequest("Can't set attendance for a future date.");
  }
  // Admin can backfill any past date down to the employee's joining date -
  // the "tracking start" cutoff only affects display, not what admin can record.
  if (employee?.joiningDate && dateKey < toDateKey(employee.joiningDate)) {
    throw ApiError.badRequest("That's before the employee's joining date.");
  }

  await assertRecordableDay(userId, dateKey);
  return writeDay({ userId, projectId, dateKey, status: action, isAdmin: true, adminId, note });
};

module.exports = {
  STATUS,
  TRACKING_START,
  markAttendance,
  getMyAttendance,
  getRosterAttendance,
  correctAttendance,
};
