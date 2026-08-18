import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

export const markAnniversaryCelebrationSeen = () => unwrap(axiosClient.put("/profile/anniversary-celebration-seen"));

export const markBirthdayCelebrationSeen = () => unwrap(axiosClient.put("/profile/birthday-celebration-seen"));

export const getMyPhoto = () => axiosClient.get("/profile/photo", { responseType: "blob" });

export const getMyIncomeTaxComputation = (financialYear) =>
  unwrap(axiosClient.get("/profile/tax-computation", { params: { financialYear } }));

export const listMyIncomeTaxComputationGenerations = () =>
  unwrap(axiosClient.get("/profile/tax-computation-generations"));

export const downloadMyIncomeTaxComputationPdf = (generationId) =>
  axiosClient.get(`/profile/tax-computation-generations/${generationId}/pdf`, { responseType: "blob" });

export const submitResignation = (reason, proposedLastWorkingDate) =>
  unwrap(axiosClient.post("/profile/resignation", { reason, proposedLastWorkingDate }));

export const getMyResignation = () => unwrap(axiosClient.get("/profile/resignation"));

export const withdrawResignation = (id) => unwrap(axiosClient.patch(`/profile/resignation/${id}/withdraw`));
