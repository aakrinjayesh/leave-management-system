import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

export const getMyEntries = (weekStart) =>
  unwrap(axiosClient.get("/employee/timesheet/entries", { params: weekStart ? { weekStart } : {} }));

export const listProjects = () => unwrap(axiosClient.get("/employee/timesheet/projects"));

// One entry per day - creates it if it doesn't exist yet, updates it in
// place if it does.
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

export const getMySubmissions = (status) =>
  unwrap(axiosClient.get("/employee/timesheet/submissions", { params: status ? { status } : {} }));

// Returns the raw response (not unwrapped) - the caller needs the blob body
// and the Content-Disposition header for the filename.
export const downloadSubmissionAttachment = (submissionId) =>
  axiosClient.get(`/employee/timesheet/submissions/${submissionId}/attachment`, { responseType: "blob" });
