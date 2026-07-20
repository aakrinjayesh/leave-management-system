import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

export const listUsers = () => unwrap(axiosClient.get("/admin/users"));

export const createUser = (payload) => unwrap(axiosClient.post("/admin/users", payload));

export const updateUserManager = (id, managerId) =>
  unwrap(axiosClient.patch(`/admin/users/${id}/manager`, { managerId }));

export const deactivateUser = (id) => unwrap(axiosClient.patch(`/admin/users/${id}/deactivate`));

export const reactivateUser = (id) => unwrap(axiosClient.patch(`/admin/users/${id}/reactivate`));

export const getUserTimesheet = (userId, view, date) =>
  unwrap(axiosClient.get(`/admin/users/${userId}/timesheet`, { params: { view, date } }));

// Raw response (not unwrapped) - caller needs the blob body and the
// Content-Disposition header for the filename.
export const exportUserTimesheet = (userId, view, date) =>
  axiosClient.get(`/admin/users/${userId}/timesheet/export`, { params: { view, date }, responseType: "blob" });

export const exportPayrollTimesheet = (date) =>
  axiosClient.get("/admin/timesheets/export", { params: { date }, responseType: "blob" });

export const listLeavePolicies = () => unwrap(axiosClient.get("/admin/leave-policies"));

export const createLeavePolicy = (payload) => unwrap(axiosClient.post("/admin/leave-policies", payload));

export const updateLeavePolicy = (id, payload) => unwrap(axiosClient.patch(`/admin/leave-policies/${id}`, payload));

export const deactivateLeavePolicy = (id) => unwrap(axiosClient.patch(`/admin/leave-policies/${id}/deactivate`));

export const reactivateLeavePolicy = (id) => unwrap(axiosClient.patch(`/admin/leave-policies/${id}/reactivate`));

export const listHolidays = () => unwrap(axiosClient.get("/admin/holidays"));

export const createHoliday = (payload) => unwrap(axiosClient.post("/admin/holidays", payload));

export const updateHoliday = (id, payload) => unwrap(axiosClient.patch(`/admin/holidays/${id}`, payload));

export const deactivateHoliday = (id) => unwrap(axiosClient.patch(`/admin/holidays/${id}/deactivate`));

export const reactivateHoliday = (id) => unwrap(axiosClient.patch(`/admin/holidays/${id}/reactivate`));

export const getUserLeaveDetail = (id) => unwrap(axiosClient.get(`/admin/users/${id}/leaves`));

export const getUserCalendar = (id, year, month) =>
  unwrap(axiosClient.get(`/admin/users/${id}/calendar`, { params: { year, month } }));

export const downloadLeaveAttachment = (requestId) =>
  axiosClient.get(`/admin/leave-requests/${requestId}/attachment`, { responseType: "blob" }).then((res) => res.data);

export const getUserDetails = (id) => unwrap(axiosClient.get(`/admin/users/${id}/details`));

export const updateUserDetails = (id, payload) => unwrap(axiosClient.patch(`/admin/users/${id}/details`, payload));

export const getSalaryStructure = () => unwrap(axiosClient.get("/admin/salary-structure"));

export const updateSalaryStructure = (payload) => unwrap(axiosClient.put("/admin/salary-structure", payload));

export const previewPayslip = (userId, year, month, tds, annualBonusPay) =>
  unwrap(axiosClient.get(`/admin/users/${userId}/payslips/preview`, { params: { year, month, tds, annualBonusPay } }));

export const generatePayslip = (userId, payload) => unwrap(axiosClient.post(`/admin/users/${userId}/payslips`, payload));

export const listPayslips = (userId) => unwrap(axiosClient.get(`/admin/users/${userId}/payslips`));

export const downloadPayslipPdf = (payslipId) =>
  axiosClient.get(`/admin/payslips/${payslipId}/pdf`, { responseType: "blob" });

export const getCompanySettings = () => unwrap(axiosClient.get("/admin/company-settings"));

// ---------- Employee documents (PAN/Aadhaar/Bank/Photo) ----------

export const uploadUserDocument = (userId, type, file) => {
  const formData = new FormData();
  formData.append("file", file);
  return unwrap(axiosClient.post(`/admin/users/${userId}/documents/${type}`, formData));
};

export const deleteUserDocument = (userId, type) =>
  unwrap(axiosClient.delete(`/admin/users/${userId}/documents/${type}`));

export const downloadUserDocument = (userId, type) =>
  axiosClient.get(`/admin/users/${userId}/documents/${type}`, { responseType: "blob" }).then((res) => res.data);

// ---------- Custom fields ----------

export const listCustomFields = (userId) => unwrap(axiosClient.get(`/admin/users/${userId}/custom-fields`));

export const createCustomField = (userId, { label, value, file }) => {
  const formData = new FormData();
  formData.append("label", label);
  if (value) formData.append("value", value);
  if (file) formData.append("file", file);
  return unwrap(axiosClient.post(`/admin/users/${userId}/custom-fields`, formData));
};

export const updateCustomField = (fieldId, { label, value, file }) => {
  const formData = new FormData();
  formData.append("label", label);
  if (value) formData.append("value", value);
  if (file) formData.append("file", file);
  return unwrap(axiosClient.patch(`/admin/custom-fields/${fieldId}`, formData));
};

export const deleteCustomField = (fieldId) => unwrap(axiosClient.delete(`/admin/custom-fields/${fieldId}`));

export const downloadCustomFieldDocument = (fieldId) =>
  axiosClient.get(`/admin/custom-fields/${fieldId}/document`, { responseType: "blob" }).then((res) => res.data);

export const updateCompanySettings = (payload) => unwrap(axiosClient.put("/admin/company-settings", payload));
