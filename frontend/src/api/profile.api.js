import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

export const markAnniversaryCelebrationSeen = () => unwrap(axiosClient.put("/profile/anniversary-celebration-seen"));

export const markBirthdayCelebrationSeen = () => unwrap(axiosClient.put("/profile/birthday-celebration-seen"));

// `files` is an optional { fieldName: File } map (photo / panDocument /
// aadharDocument / bankDocument). When present the request goes as
// multipart/form-data; otherwise plain JSON.
const patchSection = (url, data, files) => {
  const fileEntries = Object.entries(files || {}).filter(([, f]) => f);
  if (fileEntries.length === 0) {
    return unwrap(axiosClient.patch(url, data));
  }
  const form = new FormData();
  Object.entries(data || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") form.append(k, v);
  });
  fileEntries.forEach(([name, file]) => form.append(name, file));
  return unwrap(axiosClient.patch(url, form));
};

export const updateMyPersonalInfo = (data, files) => patchSection("/profile/me/personal-info", data, files);

export const updateMyStatutoryInfo = (data, files) => patchSection("/profile/me/statutory-info", data, files);

export const updateMyBankInfo = (data, files) => patchSection("/profile/me/bank-info", data, files);

export const downloadMyDocument = (type) =>
  axiosClient.get(`/profile/me/documents/${type}`, { responseType: "blob" });

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
