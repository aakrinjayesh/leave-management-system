import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

export const listMyProjects = () => unwrap(axiosClient.get("/employee/timesheet/projects"));

export const getMyTimesheetStatus = () => unwrap(axiosClient.get("/employee/timesheet/status"));

export const getMyEntries = (weekStart, projectId) =>
  unwrap(
    axiosClient.get("/employee/timesheet/entries", {
      params: { ...(weekStart ? { weekStart } : {}), ...(projectId ? { projectId } : {}) },
    })
  );

// One entry per day per project - creates it if it doesn't exist yet,
// updates it in place if it does.
export const saveEntry = (payload) => unwrap(axiosClient.post("/employee/timesheet/entries", payload));

export const deleteEntry = (id) => unwrap(axiosClient.delete(`/employee/timesheet/entries/${id}`));

export const uploadAttachment = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return unwrap(axiosClient.post("/employee/timesheet/attachment", formData));
};

export const submitWeek = (weekStartDate, attachmentOriginalName, attachmentStoredName, projectId) =>
  unwrap(
    axiosClient.post("/employee/timesheet/submissions", {
      weekStartDate,
      attachmentOriginalName,
      attachmentStoredName,
      projectId,
    })
  );

export const getMySubmissions = (status, projectId) =>
  unwrap(
    axiosClient.get("/employee/timesheet/submissions", {
      params: { ...(status ? { status } : {}), ...(projectId ? { projectId } : {}) },
    })
  );

// Returns the raw response (not unwrapped) - the caller needs the blob body
// and the Content-Disposition header for the filename.
export const downloadSubmissionAttachment = (submissionId) =>
  axiosClient.get(`/employee/timesheet/submissions/${submissionId}/attachment`, { responseType: "blob" });
