import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

export const getManagerOptions = () => unwrap(axiosClient.get("/profile/manager-options"));

export const updateMyManager = (managerId) => unwrap(axiosClient.put("/profile/manager", { managerId }));
