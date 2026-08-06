import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

export const getManagerOptions = () => unwrap(axiosClient.get("/profile/manager-options"));

export const updateMyManager = (managerId) => unwrap(axiosClient.put("/profile/manager", { managerId }));

export const markAnniversaryCelebrationSeen = () => unwrap(axiosClient.put("/profile/anniversary-celebration-seen"));

export const getMyIncomeTaxComputation = (financialYear) =>
  unwrap(axiosClient.get("/profile/tax-computation", { params: { financialYear } }));

export const listMyIncomeTaxComputationGenerations = () =>
  unwrap(axiosClient.get("/profile/tax-computation-generations"));

export const downloadMyIncomeTaxComputationPdf = (generationId) =>
  axiosClient.get(`/profile/tax-computation-generations/${generationId}/pdf`, { responseType: "blob" });
