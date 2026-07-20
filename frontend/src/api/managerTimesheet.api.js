import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

export const getTeamSubmissions = (status) =>
  unwrap(axiosClient.get("/manager/timesheets", { params: status ? { status } : {} }));

export const getEmployeeTimesheet = (employeeId, view, date) =>
  unwrap(axiosClient.get(`/manager/timesheets/employees/${employeeId}`, { params: { view, date } }));

// Returns the raw response (not unwrapped) - the caller needs the blob body
// and the Content-Disposition header for the filename.
export const exportEmployeeTimesheet = (employeeId, view, date) =>
  axiosClient.get(`/manager/timesheets/employees/${employeeId}/export`, {
    params: { view, date },
    responseType: "blob",
  });

export const approveSubmission = (id, remarks) =>
  unwrap(axiosClient.patch(`/manager/timesheets/${id}/approve`, { remarks }));

export const rejectSubmission = (id, remarks) =>
  unwrap(axiosClient.patch(`/manager/timesheets/${id}/reject`, { remarks }));
