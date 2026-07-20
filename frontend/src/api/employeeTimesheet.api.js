import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

export const getMyEntries = (weekStart) =>
  unwrap(axiosClient.get("/employee/timesheet/entries", { params: weekStart ? { weekStart } : {} }));

// One entry per day - creates it if it doesn't exist yet, updates it in
// place if it does.
export const saveEntry = (payload) => unwrap(axiosClient.post("/employee/timesheet/entries", payload));

export const deleteEntry = (id) => unwrap(axiosClient.delete(`/employee/timesheet/entries/${id}`));

export const submitWeek = (weekStartDate) =>
  unwrap(axiosClient.post("/employee/timesheet/submissions", { weekStartDate }));

export const getMySubmissions = (status) =>
  unwrap(axiosClient.get("/employee/timesheet/submissions", { params: status ? { status } : {} }));
