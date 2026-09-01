import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText, Plus, Trash2 } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import TextInput from "../../components/common/TextInput";
import FormSelect from "../../components/common/FormSelect";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import DocumentUploadField from "./DocumentUploadField";
import ProfileChangeRequestsCard from "./ProfileChangeRequestsCard";
import UpdateSalaryStructureModal from "./UpdateSalaryStructureModal";
import TaxComputationSection from "./TaxComputationSection";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { openBlobInNewTab } from "../../utils/openBlob";
import "../../styles/dashboardShared.css";

const toDateInputValue = (value) => (value ? value.slice(0, 10) : "");
const todayDateInputValue = () => new Date().toISOString().slice(0, 10);
const money = (value) => `₹${(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatMonth = (date) => new Date(date).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

const EMPLOYEE_CODE_REGEX = /^[A-Za-z0-9_-]+$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const UAN_REGEX = /^\d{12}$/;
const AADHAR_REGEX = /^\d{12}$/;
const BANK_ACCOUNT_REGEX = /^\d{9,18}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PF_NUMBER_REGEX = /^[A-Za-z0-9/]+$/;

// Mirrors the backend's updateUserDetailsSchema so the admin sees these
// errors immediately, without waiting on a round trip.
// A native <input type="date"> lets you type a 5-6 digit year; a real date is
// always exactly yyyy-mm-dd with a 4-digit year.
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const isSaneYear = (dateStr) => {
  const year = Number(dateStr.slice(0, 4));
  return year >= 1900 && year <= 2100;
};

const validateForm = (form) => {
  const errors = {};

  if (form.employeeCode && !EMPLOYEE_CODE_REGEX.test(form.employeeCode.trim())) {
    errors.employeeCode = "Only letters, numbers, hyphens, and underscores are allowed.";
  }
  if (form.personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.personalEmail.trim())) {
    errors.personalEmail = "Please enter a valid personal email address.";
  }
  if (form.pinCode && !/^\d{6}$/.test(form.pinCode.trim())) {
    errors.pinCode = "PIN code must be exactly 6 digits.";
  }
  if (form.birthDate && (!ISO_DATE_REGEX.test(form.birthDate) || !isSaneYear(form.birthDate))) {
    errors.birthDate = "Please enter a valid date with a 4-digit year.";
  } else if (form.birthDate && form.birthDate > todayDateInputValue()) {
    errors.birthDate = "Date of birth can't be in the future.";
  }
  if (form.joiningDate && (!ISO_DATE_REGEX.test(form.joiningDate) || !isSaneYear(form.joiningDate))) {
    errors.joiningDate = "Please enter a valid date with a 4-digit year.";
  }
  if (form.pan && !PAN_REGEX.test(form.pan.trim().toUpperCase())) {
    errors.pan = "PAN must be in the format ABCDE1234F.";
  }
  if (form.uan && !UAN_REGEX.test(form.uan.trim())) {
    errors.uan = "UAN must be exactly 12 digits.";
  }
  if (form.aadharNumber && !AADHAR_REGEX.test(form.aadharNumber.trim())) {
    errors.aadharNumber = "Aadhaar number must be exactly 12 digits.";
  }
  if (form.bankAccountNumber && !BANK_ACCOUNT_REGEX.test(form.bankAccountNumber.trim())) {
    errors.bankAccountNumber = "Must be 9 to 18 digits.";
  }
  if (form.ifscCode && !IFSC_REGEX.test(form.ifscCode.trim().toUpperCase())) {
    errors.ifscCode = "IFSC code must be in the format ABCD0123456.";
  }
  if (form.pfNumber && !PF_NUMBER_REGEX.test(form.pfNumber.trim())) {
    errors.pfNumber = "Only letters, numbers, and slashes are allowed.";
  }

  return errors;
};

const toForm = (user) => ({
  employeeCode: user.employeeCode ?? "",
  personalEmail: user.personalEmail ?? "",
  phone: user.phone ?? "",
  birthDate: toDateInputValue(user.birthDate),
  joiningDate: toDateInputValue(user.joiningDate),
  gender: user.gender ?? "",
  fatherName: user.fatherName ?? "",
  fatherMotherPhone: user.fatherMotherPhone ?? "",
  spouseName: user.spouseName ?? "",
  maritalStatus: user.maritalStatus ?? "",
  nationality: user.nationality ?? "",
  qualification: user.qualification ?? "",
  designation: user.designation ?? "",
  location: user.location ?? "",
  taxRegime: user.taxRegime ?? "",
  residentialAddress: user.residentialAddress ?? "",
  pinCode: user.pinCode ?? "",
  residentialStatus: user.residentialStatus ?? "",
  pan: user.pan ?? "",
  panHolderName: user.panHolderName ?? "",
  uan: user.uan ?? "",
  aadharNumber: user.aadharNumber ?? "",
  aadharHolderName: user.aadharHolderName ?? "",
  bankAccountNumber: user.bankAccountNumber ?? "",
  bankName: user.bankName ?? "",
  ifscCode: user.ifscCode ?? "",
  pfNumber: user.pfNumber ?? "",
});

// Which form fields belong to which card. Each card saves independently -
// only its own fields go in the PATCH, so an admin editing one thing doesn't
// have to scroll to a single button at the bottom (and can't accidentally
// re-save unrelated sections). uan has no input of its own, so it rides
// along with the PAN card to keep its stored value intact.
const SECTIONS = {
  personal: {
    label: "Personal information",
    fields: [
      "employeeCode",
      "personalEmail",
      "gender",
      "birthDate",
      "joiningDate",
      "phone",
      "maritalStatus",
      "fatherName",
      "fatherMotherPhone",
      "spouseName",
      "nationality",
      "qualification",
    ],
  },
  employment: {
    label: "Employment details",
    fields: ["designation", "location", "taxRegime", "residentialAddress", "pinCode", "residentialStatus"],
  },
  pan: { label: "PAN details", fields: ["pan", "panHolderName", "uan"] },
  aadhaar: { label: "Aadhaar details", fields: ["aadharNumber", "aadharHolderName"] },
  bank: { label: "Bank details", fields: ["bankAccountNumber", "bankName", "ifscCode", "pfNumber"] },
};

const ALL_DETAIL_FIELDS = Object.values(SECTIONS).flatMap((section) => section.fields);

// Fields whose form value is used as-is (dropdowns, date inputs); everything
// else is a text field that gets trimmed. pan/ifscCode are also upper-cased.
const RAW_FIELDS = new Set(["birthDate", "joiningDate", "gender", "maritalStatus", "taxRegime", "residentialStatus"]);
const UPPERCASE_FIELDS = new Set(["pan", "ifscCode"]);

const toPayloadValue = (field, value) => {
  if (RAW_FIELDS.has(field)) return value || null;
  const trimmed = (value || "").trim();
  return (UPPERCASE_FIELDS.has(field) ? trimmed.toUpperCase() : trimmed) || null;
};

// The PATCH endpoint's validator fills in `null` for every string field it
// doesn't receive, so a partial body would wipe the other sections. We send
// the FULL record every time: the section being saved comes from the live
// form, every other field from the last-loaded values (`baseForm`).
const buildSectionPayload = (baseForm, liveForm, fields) => {
  const merged = { ...baseForm };
  fields.forEach((field) => {
    merged[field] = liveForm[field];
  });
  return Object.fromEntries(ALL_DETAIL_FIELDS.map((field) => [field, toPayloadValue(field, merged[field])]));
};

export default function EmployeeDetailsPage() {
  const { id } = useParams();
  return <EmployeeDetailsContent key={id} id={id} />;
}

function EmployeeDetailsContent({ id }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [savingSection, setSavingSection] = useState(null);
  const [busyDocType, setBusyDocType] = useState(null);
  const [structureHistory, setStructureHistory] = useState(null);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);

  const [customFields, setCustomFields] = useState(null);
  const [newField, setNewField] = useState({ label: "", value: "", file: null });
  const [isAddingField, setIsAddingField] = useState(false);
  const [deletingFieldId, setDeletingFieldId] = useState(null);
  const [nextCodeNum, setNextCodeNum] = useState(null);

  const loadUser = () =>
    adminApi.getUserDetails(id).then((data) => {
      setUser(data.user);
      setForm(toForm(data.user));
      setNextCodeNum(data.nextEmployeeCodeNumber || null);
    });

  const loadCustomFields = () => adminApi.listCustomFields(id).then((data) => setCustomFields(data.customFields));

  const loadStructureHistory = () =>
    adminApi.getSalaryStructureHistory(id).then((data) => setStructureHistory(data.history));

  useEffect(() => {
    loadUser();
    loadCustomFields();
    loadStructureHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const latestStructure = structureHistory && structureHistory.length > 0 ? structureHistory[0] : null;
  const pastStructures = structureHistory ? structureHistory.slice(1) : [];

  const handleChange = (field) => (e) => {
    setSuccess("");
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const saveSection = async (sectionKey) => {
    const { label, fields } = SECTIONS[sectionKey];
    setError("");
    setSuccess("");

    const allErrors = validateForm(form);
    const sectionErrors = Object.fromEntries(
      Object.entries(allErrors).filter(([field]) => fields.includes(field)),
    );
    setFieldErrors((prev) => {
      const cleared = { ...prev };
      fields.forEach((field) => delete cleared[field]);
      return { ...cleared, ...sectionErrors };
    });
    if (Object.keys(sectionErrors).length > 0) {
      setError(`Please fix the highlighted fields in ${label}.`);
      return;
    }

    setSavingSection(sectionKey);
    try {
      // baseForm = last-saved values (from `user`); only this section's fields
      // come from the live form, so other cards' in-progress edits aren't saved.
      const payload = buildSectionPayload(toForm(user), form, fields);
      const data = await adminApi.updateUserDetails(id, payload);
      setUser((prev) => ({ ...prev, ...data.user }));
      // Re-sync only this section's fields, so unsaved edits in other cards stay put.
      const refreshed = toForm(data.user);
      setForm((prev) => ({
        ...prev,
        ...Object.fromEntries(fields.map((field) => [field, refreshed[field]])),
      }));
      setSuccess(`${label} updated.`);
    } catch (err) {
      setError(getErrorMessage(err, `Couldn't save ${label}. Please try again.`));
    } finally {
      setSavingSection(null);
    }
  };

  const handleDocumentUpload = async (type, file) => {
    setError("");
    setBusyDocType(type);
    try {
      await adminApi.uploadUserDocument(id, type, file);
      await loadUser();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't upload this file."));
    } finally {
      setBusyDocType(null);
    }
  };

  const handleDocumentView = async (type) => {
    setError("");
    try {
      const blob = await adminApi.downloadUserDocument(id, type);
      openBlobInNewTab(blob);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't open this document."));
    }
  };

  const handleDocumentRemove = async (type) => {
    setError("");
    setBusyDocType(type);
    try {
      await adminApi.deleteUserDocument(id, type);
      await loadUser();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't remove this document."));
    } finally {
      setBusyDocType(null);
    }
  };

  const handleAddCustomField = async (e) => {
    e.preventDefault();
    setError("");

    if (!newField.label.trim()) {
      setError("Please enter a label for the new field.");
      return;
    }

    setIsAddingField(true);
    try {
      await adminApi.createCustomField(id, newField);
      setNewField({ label: "", value: "", file: null });
      await loadCustomFields();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't add this field."));
    } finally {
      setIsAddingField(false);
    }
  };

  const handleDeleteCustomField = async (fieldId) => {
    setError("");
    setDeletingFieldId(fieldId);
    try {
      await adminApi.deleteCustomField(fieldId);
      await loadCustomFields();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't remove this field."));
    } finally {
      setDeletingFieldId(null);
    }
  };

  const handleViewCustomFieldDocument = async (fieldId) => {
    setError("");
    try {
      const blob = await adminApi.downloadCustomFieldDocument(fieldId);
      openBlobInNewTab(blob);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't open this document."));
    }
  };

  if (!user || !form) {
    return (
      <DashboardLayout title="Employee Details">
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size={28} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Employee Details">
      <div className="page-header">
        <div>
          <h1>
            {user.firstName} {user.lastName}
          </h1>
          <p>{user.email}</p>
        </div>
        <Button
          variant="secondary"
          className="page-header-btn"
          onClick={() => navigate(`/admin/users/${id}/offer-letter`)}
        >
          <FileText size={16} />
          Offer Letter
        </Button>
      </div>

      <Alert type="error">{error}</Alert>
      <Alert type="success">{success}</Alert>

      <ProfileChangeRequestsCard userId={id} onDecided={loadUser} />

      <div>
        <form
          className="card"
          style={{ marginBottom: 20 }}
          onSubmit={(e) => {
            e.preventDefault();
            saveSection("personal");
          }}
          noValidate
        >
          <div className="card-section">
            <span className="card-section-title">Personal information</span>
            <p className="card-section-subtitle">
              Admin-managed only. The employee sees these read-only on their own Profile page.
            </p>

            <div className="form-two-col">
              <div>
                <TextInput
                  label="Employee code"
                  value={form.employeeCode}
                  onChange={handleChange("employeeCode")}
                  error={fieldErrors.employeeCode}
                />
                {nextCodeNum && (
                  <p className="helper-text" style={{ marginTop: 2 }}>
                    Next number in sequence: <strong>{nextCodeNum}</strong> (e.g. TECH-2026-{nextCodeNum})
                  </p>
                )}
              </div>
              <TextInput
                label="Personal email"
                type="email"
                placeholder="name@gmail.com"
                value={form.personalEmail}
                onChange={handleChange("personalEmail")}
                error={fieldErrors.personalEmail}
              />
            </div>

            <div className="form-two-col">
              <FormSelect label="Gender" value={form.gender} onChange={handleChange("gender")}>
                <option value="">Not set</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </FormSelect>
              <TextInput
                label="Date of birth"
                type="date"
                min="1900-01-01"
                max={todayDateInputValue()}
                value={form.birthDate}
                onChange={handleChange("birthDate")}
                error={fieldErrors.birthDate}
              />
            </div>

            <div className="form-two-col">
              <TextInput
                label="Date of joining"
                type="date"
                min="1900-01-01"
                max="2100-12-31"
                value={form.joiningDate}
                onChange={handleChange("joiningDate")}
                error={fieldErrors.joiningDate}
              />
              <TextInput label="Mobile number" value={form.phone} onChange={handleChange("phone")} />
            </div>

            <div className="form-two-col">
              <FormSelect label="Marital status" value={form.maritalStatus} onChange={handleChange("maritalStatus")}>
                <option value="">Not set</option>
                <option value="SINGLE">Single</option>
                <option value="MARRIED">Married</option>
                <option value="OTHER">Other</option>
              </FormSelect>
              <TextInput label="Father's name" value={form.fatherName} onChange={handleChange("fatherName")} />
            </div>

            <div className="form-two-col">
              <TextInput
                label="Father/Mother Ph. number"
                value={form.fatherMotherPhone}
                onChange={handleChange("fatherMotherPhone")}
              />
              <TextInput label="Spouse name" value={form.spouseName} onChange={handleChange("spouseName")} />
            </div>

            <div className="form-two-col">
              <TextInput label="Nationality" value={form.nationality} onChange={handleChange("nationality")} />
              <TextInput label="Qualification" value={form.qualification} onChange={handleChange("qualification")} />
            </div>

            <div className="modal-actions" style={{ justifyContent: "flex-start", marginTop: 8 }}>
              <Button type="submit" isLoading={savingSection === "personal"}>
                Update personal information
              </Button>
            </div>
          </div>
        </form>

        <form
          className="card"
          style={{ marginBottom: 20 }}
          onSubmit={(e) => {
            e.preventDefault();
            saveSection("employment");
          }}
          noValidate
        >
          <div className="card-section">
            <span className="card-section-title">Employment details</span>
            <p className="card-section-subtitle">Shown on this employee's payslips.</p>

            <div className="form-two-col">
              <TextInput label="Designation" value={form.designation} onChange={handleChange("designation")} />
              <TextInput label="Location" value={form.location} onChange={handleChange("location")} />
            </div>

            <FormSelect label="Tax regime" value={form.taxRegime} onChange={handleChange("taxRegime")}>
              <option value="">Not set</option>
              <option value="OLD">Old Tax Regime</option>
              <option value="NEW">New Tax Regime</option>
            </FormSelect>

            <p className="card-section-subtitle" style={{ marginTop: 16 }}>
              Used only for the annual Income Tax Computation Statement.
            </p>

            <TextInput
              label="Residential address"
              value={form.residentialAddress}
              onChange={handleChange("residentialAddress")}
            />

            <div className="form-two-col">
              <TextInput
                label="Pin Code"
                inputMode="numeric"
                placeholder="6 digits"
                value={form.pinCode}
                onChange={handleChange("pinCode")}
                error={fieldErrors.pinCode}
              />
              <FormSelect
                label="Residential status"
                value={form.residentialStatus}
                onChange={handleChange("residentialStatus")}
              >
                <option value="">Not set</option>
                <option value="RESIDENT">Resident</option>
                <option value="NON_RESIDENT">Non-Resident</option>
                <option value="RESIDENT_NOT_ORDINARILY_RESIDENT">Resident but Not Ordinarily Resident (RNOR)</option>
              </FormSelect>
            </div>

            <div className="modal-actions" style={{ justifyContent: "flex-start", marginTop: 8 }}>
              <Button type="submit" isLoading={savingSection === "employment"}>
                Update employment details
              </Button>
            </div>
          </div>
        </form>

        <form
          className="card"
          style={{ marginBottom: 20 }}
          onSubmit={(e) => {
            e.preventDefault();
            saveSection("pan");
          }}
          noValidate
        >
          <div className="card-section">
            <span className="card-section-title">PAN details</span>

            <div className="form-two-col">
              <TextInput
                label="PAN number"
                placeholder="ABCDE1234F"
                value={form.pan}
                onChange={handleChange("pan")}
                error={fieldErrors.pan}
              />
              <TextInput label="Name as per PAN card" value={form.panHolderName} onChange={handleChange("panHolderName")} />
            </div>

            <div className="modal-actions" style={{ justifyContent: "flex-start", marginTop: 8, marginBottom: 4 }}>
              <Button type="submit" isLoading={savingSection === "pan"}>
                Update PAN details
              </Button>
            </div>

            <DocumentUploadField
              label="PAN card (PDF/JPEG/PNG)"
              hasDocument={Boolean(user.panDocumentUrl)}
              isBusy={busyDocType === "pan"}
              onUpload={(file) => handleDocumentUpload("pan", file)}
              onView={() => handleDocumentView("pan")}
              onRemove={() => handleDocumentRemove("pan")}
            />
          </div>
        </form>

        <form
          className="card"
          style={{ marginBottom: 20 }}
          onSubmit={(e) => {
            e.preventDefault();
            saveSection("aadhaar");
          }}
          noValidate
        >
          <div className="card-section">
            <span className="card-section-title">Aadhaar details</span>

            <div className="form-two-col">
              <TextInput
                label="Aadhaar number"
                placeholder="12-digit number"
                value={form.aadharNumber}
                onChange={handleChange("aadharNumber")}
                error={fieldErrors.aadharNumber}
              />
              <TextInput
                label="Name as per Aadhaar"
                value={form.aadharHolderName}
                onChange={handleChange("aadharHolderName")}
              />
            </div>

            <div className="modal-actions" style={{ justifyContent: "flex-start", marginTop: 8, marginBottom: 4 }}>
              <Button type="submit" isLoading={savingSection === "aadhaar"}>
                Update Aadhaar details
              </Button>
            </div>

            <DocumentUploadField
              label="Aadhaar card (PDF only)"
              accept=".pdf"
              hasDocument={Boolean(user.aadharDocumentUrl)}
              isBusy={busyDocType === "aadhar"}
              onUpload={(file) => handleDocumentUpload("aadhar", file)}
              onView={() => handleDocumentView("aadhar")}
              onRemove={() => handleDocumentRemove("aadhar")}
            />
          </div>
        </form>

        <form
          className="card"
          style={{ marginBottom: 20 }}
          onSubmit={(e) => {
            e.preventDefault();
            saveSection("bank");
          }}
          noValidate
        >
          <div className="card-section">
            <span className="card-section-title">Bank details</span>

            <div className="form-two-col">
              <TextInput
                label="Bank account number"
                value={form.bankAccountNumber}
                onChange={handleChange("bankAccountNumber")}
                error={fieldErrors.bankAccountNumber}
              />
              <TextInput label="Bank name" value={form.bankName} onChange={handleChange("bankName")} />
            </div>

            <div className="form-two-col">
              <TextInput
                label="IFSC code"
                placeholder="ABCD0123456"
                value={form.ifscCode}
                onChange={handleChange("ifscCode")}
                error={fieldErrors.ifscCode}
              />
              <TextInput
                label="PF number"
                value={form.pfNumber}
                onChange={handleChange("pfNumber")}
                error={fieldErrors.pfNumber}
              />
            </div>

            <div className="modal-actions" style={{ justifyContent: "flex-start", marginTop: 8, marginBottom: 4 }}>
              <Button type="submit" isLoading={savingSection === "bank"}>
                Update bank details
              </Button>
            </div>

            <DocumentUploadField
              label="Bank passbook / statement (PDF/JPEG/PNG)"
              hasDocument={Boolean(user.bankDocumentUrl)}
              isBusy={busyDocType === "bank"}
              onUpload={(file) => handleDocumentUpload("bank", file)}
              onView={() => handleDocumentView("bank")}
              onRemove={() => handleDocumentRemove("bank")}
            />
          </div>
        </form>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-section">
            <span className="card-section-title">Photo</span>

            <DocumentUploadField
              label="Passport-size photo (JPEG/PNG/PDF)"
              hasDocument={Boolean(user.photoUrl)}
              isBusy={busyDocType === "photo"}
              onUpload={(file) => handleDocumentUpload("photo", file)}
              onView={() => handleDocumentView("photo")}
              onRemove={() => handleDocumentRemove("photo")}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-section">
          <span className="card-section-title">Salary</span>
          <p className="card-section-subtitle">
            Current CTC (annual): <strong>{user.salaryCtc ? money(user.salaryCtc) : "Not set"}</strong>
          </p>

          {latestStructure ? (
            <>
              <p className="card-section-subtitle">
                Effective from <strong>{formatMonth(latestStructure.effectiveFrom)}</strong> onward
              </p>

              <div className="profile-detail-grid">
                <div>
                  <div className="profile-detail-label">Basic</div>
                  <div className="profile-detail-value">{latestStructure.basicPercentOfCtc}% of monthly CTC</div>
                </div>
                <div>
                  <div className="profile-detail-label">HRA</div>
                  <div className="profile-detail-value">{latestStructure.hraPercentOfBasic}% of Basic</div>
                </div>
                <div>
                  <div className="profile-detail-label">LTA</div>
                  <div className="profile-detail-value">{latestStructure.ltaPercentOfBasic}% of Basic</div>
                </div>
                <div>
                  <div className="profile-detail-label">Guaranteed Allowance</div>
                  <div className="profile-detail-value">
                    {latestStructure.guaranteedAllowancePercentOfBasic}% of Basic
                  </div>
                </div>
                <div>
                  <div className="profile-detail-label">Conveyance</div>
                  <div className="profile-detail-value">{money(latestStructure.conveyanceMonthly)}/month</div>
                </div>
                <div>
                  <div className="profile-detail-label">Provident Fund</div>
                  <div className="profile-detail-value">{money(latestStructure.pfMonthlyAmount)}/month</div>
                </div>
                <div>
                  <div className="profile-detail-label">Professional Tax</div>
                  <div className="profile-detail-value">{money(latestStructure.professionalTax)}/month</div>
                </div>
                <div>
                  <div className="profile-detail-label">PT applies once gross pay reaches</div>
                  <div className="profile-detail-value">{money(latestStructure.professionalTaxThreshold)}</div>
                </div>
              </div>
            </>
          ) : (
            <p className="card-section-subtitle">No salary structure recorded yet for this employee.</p>
          )}

          <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
            <Button type="button" onClick={() => setIsStructureModalOpen(true)}>
              Update Salary Structure
            </Button>
          </div>
        </div>
      </div>

      {pastStructures.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-section">
            <span className="card-section-title">Past salary structures</span>
            <p className="card-section-subtitle">Earlier entries, most recent first - each was effective until the next one started.</p>

            {pastStructures.map((entry, index) => (
              <div key={entry.id} style={{ marginTop: index === 0 ? 0 : 24, paddingTop: index === 0 ? 0 : 24, borderTop: index === 0 ? "none" : "1px solid var(--border-color, #e5e7eb)" }}>
                <p className="card-section-subtitle">
                  Effective from <strong>{formatMonth(entry.effectiveFrom)}</strong> · CTC (annual): <strong>{money(entry.ctc)}</strong>
                </p>

                <div className="profile-detail-grid">
                  <div>
                    <div className="profile-detail-label">Basic</div>
                    <div className="profile-detail-value">{entry.basicPercentOfCtc}% of monthly CTC</div>
                  </div>
                  <div>
                    <div className="profile-detail-label">HRA</div>
                    <div className="profile-detail-value">{entry.hraPercentOfBasic}% of Basic</div>
                  </div>
                  <div>
                    <div className="profile-detail-label">LTA</div>
                    <div className="profile-detail-value">{entry.ltaPercentOfBasic}% of Basic</div>
                  </div>
                  <div>
                    <div className="profile-detail-label">Guaranteed Allowance</div>
                    <div className="profile-detail-value">{entry.guaranteedAllowancePercentOfBasic}% of Basic</div>
                  </div>
                  <div>
                    <div className="profile-detail-label">Conveyance</div>
                    <div className="profile-detail-value">{money(entry.conveyanceMonthly)}/month</div>
                  </div>
                  <div>
                    <div className="profile-detail-label">Provident Fund</div>
                    <div className="profile-detail-value">{money(entry.pfMonthlyAmount)}/month</div>
                  </div>
                  <div>
                    <div className="profile-detail-label">Professional Tax</div>
                    <div className="profile-detail-value">{money(entry.professionalTax)}/month</div>
                  </div>
                  <div>
                    <div className="profile-detail-label">PT applies once gross pay reaches</div>
                    <div className="profile-detail-value">{money(entry.professionalTaxThreshold)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isStructureModalOpen && (
        <UpdateSalaryStructureModal
          userId={id}
          onClose={() => setIsStructureModalOpen(false)}
          onSuccess={() => {
            setIsStructureModalOpen(false);
            setSuccess("Salary structure updated.");
            loadUser();
            loadStructureHistory();
          }}
        />
      )}

      <TaxComputationSection userId={id} taxRegime={user.taxRegime} joiningDate={user.joiningDate} />

      <div className="card">
        <div className="card-section">
          <span className="card-section-title">Custom fields</span>
          <p className="card-section-subtitle">
            Add any extra field this employee needs that isn't covered above - a label, an optional value, and an
            optional PDF/image.
          </p>

          {!customFields ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
              <Spinner size={24} />
            </div>
          ) : (
            <>
              {customFields.length > 0 && (
                <div className="data-table-wrap" style={{ marginBottom: 16 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Label</th>
                        <th>Value</th>
                        <th>Document</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {customFields.map((field) => (
                        <tr key={field.id}>
                          <td className="table-cell-primary">{field.label}</td>
                          <td className="table-cell-secondary">{field.value || "—"}</td>
                          <td>
                            {field.documentUrl ? (
                              <button
                                type="button"
                                className="row-action-btn"
                                onClick={() => handleViewCustomFieldDocument(field.id)}
                              >
                                View
                              </button>
                            ) : (
                              <span className="table-cell-secondary">—</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="row-action-btn reject"
                              disabled={deletingFieldId === field.id}
                              onClick={() => handleDeleteCustomField(field.id)}
                            >
                              <Trash2 size={14} />
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <form onSubmit={handleAddCustomField} noValidate>
                <div className="form-two-col">
                  <TextInput
                    label="Label"
                    placeholder="e.g. Blood Group"
                    value={newField.label}
                    onChange={(e) => setNewField((prev) => ({ ...prev, label: e.target.value }))}
                  />
                  <TextInput
                    label="Value (optional)"
                    value={newField.value}
                    onChange={(e) => setNewField((prev) => ({ ...prev, value: e.target.value }))}
                  />
                </div>

                <div className="field">
                  <label className="field-label">Attachment (optional)</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setNewField((prev) => ({ ...prev, file: e.target.files[0] || null }))}
                  />
                </div>

                <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
                  <Button type="submit" variant="secondary" isLoading={isAddingField}>
                    <Plus size={16} />
                    Add field
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
