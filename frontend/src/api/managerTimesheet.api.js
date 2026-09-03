import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

export const getTeamSubmissions = (status) =>
  unwrap(axiosClient.get("/manager/timesheets", { params: status ? { status } : {} }));

export const getEmployeeTimesheet = (employeeId, view, date, projectId) =>
  unwrap(axiosClient.get(`/manager/timesheets/employees/${employeeId}`, { params: { view, date, projectId } }));

// Returns the raw response (not unwrapped) - the caller needs the blob body
// and the Content-Disposition header for the filename.
export const exportEmployeeTimesheet = (employeeId, view, date, projectId) =>
  axiosClient.get(`/manager/timesheets/employees/${employeeId}/export`, {
    params: { view, date, projectId },
    responseType: "blob",
  });

// Returns the raw response - caller needs the blob body and the
// Content-Disposition header for the filename.
export const downloadSubmissionAttachment = (submissionId) =>
  axiosClient.get(`/manager/timesheets/submissions/${submissionId}/attachment`, { responseType: "blob" });

// --- Log a timesheet on a direct report's behalf ---

export const getLogPeriod = (employeeId, projectId, date) =>
  unwrap(
    axiosClient.get(`/manager/timesheets/employees/${employeeId}/log-period`, {
      params: { ...(projectId ? { projectId } : {}), ...(date ? { date } : {}) },
    })
  );

export const uploadLogAttachment = (employeeId, file) => {
  const formData = new FormData();
  formData.append("file", file);
  return unwrap(axiosClient.post(`/manager/timesheets/employees/${employeeId}/log-attachment`, formData));
};

export const logTimesheet = (employeeId, payload) =>
  unwrap(axiosClient.post(`/manager/timesheets/employees/${employeeId}/log`, payload));

export const approveSubmission = (id, remarks) =>
  unwrap(axiosClient.patch(`/manager/timesheets/${id}/approve`, { remarks }));

export const rejectSubmission = (id, remarks) =>
  unwrap(axiosClient.patch(`/manager/timesheets/${id}/reject`, { remarks }));
