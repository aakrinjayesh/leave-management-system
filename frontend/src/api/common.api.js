import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

export const getLeavePolicies = () => unwrap(axiosClient.get("/leave-policies"));

export const getConfig = () => unwrap(axiosClient.get("/config"));
