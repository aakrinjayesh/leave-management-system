import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

export const getOverview = () => unwrap(axiosClient.get("/manager/overview"));

export const getEmployees = () => unwrap(axiosClient.get("/manager/employees"));

export const getEmployeeDetail = (id) => unwrap(axiosClient.get(`/manager/employees/${id}`));

export const createLeaveForEmployee = (employeeId, payload) =>
  unwrap(axiosClient.post(`/manager/employees/${employeeId}/leave-requests`, payload));

export const getTeamLeaveRequests = (status) =>
  unwrap(axiosClient.get("/manager/leave-requests", { params: status ? { status } : {} }));

export const downloadTeamAttachment = (requestId) =>
  axiosClient.get(`/manager/leave-requests/${requestId}/attachment`, { responseType: "blob" }).then((res) => res.data);

export const approveLeaveRequest = (id, remarks) =>
  unwrap(axiosClient.patch(`/manager/leave-requests/${id}/approve`, { remarks }));

export const rejectLeaveRequest = (id, remarks) =>
  unwrap(axiosClient.patch(`/manager/leave-requests/${id}/reject`, { remarks }));

export const getTeamCalendar = (year, month) =>
  unwrap(axiosClient.get("/manager/calendar", { params: { year, month } }));

export const getTeamResignations = () => unwrap(axiosClient.get("/manager/resignations"));

export const getTeamWfhRequests = () => unwrap(axiosClient.get("/manager/wfh-requests"));
