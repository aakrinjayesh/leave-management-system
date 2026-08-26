import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

export const submitWfhRequest = (payload) => unwrap(axiosClient.post("/employee/wfh", payload));

export const getMyWfhRequests = () => unwrap(axiosClient.get("/employee/wfh"));

export const withdrawWfhRequest = (id) => unwrap(axiosClient.patch(`/employee/wfh/${id}/withdraw`));
