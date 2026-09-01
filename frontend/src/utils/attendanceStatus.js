// Single source of truth for how each derived attendance status is shown -
// label, a one/two-letter grid marker, and the CSS modifier class (styles
// live in dashboardShared.css under `.att-*`).
export const ATTENDANCE_STATUS = {
  PRESENT: { label: "Present", short: "P", cls: "is-present" },
  HALF_DAY: { label: "Half day", short: "½", cls: "is-half" },
  WFH: { label: "WFH", short: "W", cls: "is-wfh" },
  ON_LEAVE: { label: "On leave", short: "LV", cls: "is-leave" },
  ABSENT: { label: "Absent", short: "A", cls: "is-absent" },
  NOT_MARKED: { label: "Not marked", short: "·", cls: "is-notmarked" },
  HOLIDAY: { label: "Holiday", short: "H", cls: "is-holiday" },
  WEEKEND: { label: "Weekend", short: "", cls: "is-weekend" },
  NOT_TRACKED: { label: "Not tracked", short: "", cls: "is-nottracked" },
  FUTURE: { label: "", short: "", cls: "is-future" },
};

export const statusMeta = (status) => ATTENDANCE_STATUS[status] || ATTENDANCE_STATUS.FUTURE;
