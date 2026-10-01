import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

// Employee
export const getMyAttendance = (year, month) =>
  unwrap(axiosClient.get("/attendance/me", { params: { year, month } }));

// status: "PRESENT" | "HALF_DAY" | "ABSENT" (ABSENT clears the day)
export const markAttendance = ({ projectId, date, status }) =>
  unwrap(axiosClient.post("/attendance/mark", { projectId, date, status }));

// Manager - direct reports
export const getTeamAttendance = (year, month) =>
  unwrap(axiosClient.get("/attendance/team", { params: { year, month } }));

// Admin - everyone
export const getCompanyAttendance = (year, month) =>
  unwrap(axiosClient.get("/attendance/company", { params: { year, month } }));

export const correctAttendance = (payload) => unwrap(axiosClient.patch("/attendance/correct", payload));
