import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

export const getDashboardSummary = () => unwrap(axiosClient.get("/employee/leave/summary"));

export const getMyBalances = () => unwrap(axiosClient.get("/employee/leave/balances"));

export const getMyLeaveRequests = (status) =>
  unwrap(axiosClient.get("/employee/leave/requests", { params: status ? { status } : {} }));

export const applyLeave = (payload) => unwrap(axiosClient.post("/employee/leave/requests", payload));

export const uploadAttachment = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return unwrap(axiosClient.post("/employee/leave/attachments", formData));
};

export const downloadMyAttachment = (requestId) =>
  axiosClient.get(`/employee/leave/requests/${requestId}/attachment`, { responseType: "blob" }).then((res) => res.data);

export const cancelLeaveRequest = (id) => unwrap(axiosClient.patch(`/employee/leave/requests/${id}/cancel`));

export const getMyCalendar = (year, month) =>
  unwrap(axiosClient.get("/employee/leave/calendar", { params: { year, month } }));
