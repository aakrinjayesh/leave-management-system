import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

const buildClaimForm = ({ subject, description, amount, files }) => {
  const form = new FormData();
  form.append("subject", subject);
  form.append("description", description);
  form.append("amount", String(amount));
  for (const file of files || []) form.append("files", file);
  return form;
};

// ----- Mine (any account) -----
export const getMyClaims = (status) =>
  unwrap(axiosClient.get("/reimbursements", { params: status ? { status } : {} }));

export const getMyClaim = (id) => unwrap(axiosClient.get(`/reimbursements/${id}`));

export const submitClaim = (payload) =>
  unwrap(axiosClient.post("/reimbursements", buildClaimForm(payload)));

export const cancelClaim = (id) => unwrap(axiosClient.patch(`/reimbursements/${id}/cancel`));

// ----- Manager -----
export const getTeamClaims = (status) =>
  unwrap(axiosClient.get("/manager/reimbursements", { params: status ? { status } : {} }));

export const logClaimForReport = (employeeId, payload) =>
  unwrap(axiosClient.post(`/manager/employees/${employeeId}/reimbursements`, buildClaimForm(payload)));

export const managerApproveClaim = (id, remarks) =>
  unwrap(axiosClient.patch(`/manager/reimbursements/${id}/approve`, { remarks }));

export const managerRejectClaim = (id, remarks) =>
  unwrap(axiosClient.patch(`/manager/reimbursements/${id}/reject`, { remarks }));

// ----- Admin -----
export const getAllClaims = (status) =>
  unwrap(axiosClient.get("/admin/reimbursements", { params: status ? { status } : {} }));

export const logClaimForUser = (userId, payload) =>
  unwrap(axiosClient.post(`/admin/users/${userId}/reimbursements`, buildClaimForm(payload)));

export const adminApproveClaim = (id, remarks) =>
  unwrap(axiosClient.patch(`/admin/reimbursements/${id}/approve`, { remarks }));

export const adminRejectClaim = (id, remarks) =>
  unwrap(axiosClient.patch(`/admin/reimbursements/${id}/reject`, { remarks }));
