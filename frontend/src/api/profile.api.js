import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

export const markAnniversaryCelebrationSeen = () => unwrap(axiosClient.put("/profile/anniversary-celebration-seen"));

export const markBirthdayCelebrationSeen = () => unwrap(axiosClient.put("/profile/birthday-celebration-seen"));

export const updateMyPersonalInfo = (data) => unwrap(axiosClient.patch("/profile/me/personal-info", data));

export const updateMyStatutoryInfo = (data) => unwrap(axiosClient.patch("/profile/me/statutory-info", data));

export const updateMyBankInfo = (data) => unwrap(axiosClient.patch("/profile/me/bank-info", data));

export const getMyProfileChangeRequests = () => unwrap(axiosClient.get("/profile/me/change-requests"));

export const getMyIntro = () => unwrap(axiosClient.get("/profile/me/intro"));

export const updateMyIntro = (data) => unwrap(axiosClient.put("/profile/me/intro", data));

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
