import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileCheck, Paperclip } from "lucide-react";
import Modal from "../../components/common/Modal";
import FormSelect from "../../components/common/FormSelect";
import TextInput from "../../components/common/TextInput";
import TextArea from "../../components/common/TextArea";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as commonApi from "../../api/common.api";
import * as employeeLeaveApi from "../../api/employeeLeave.api";
import { useAuth } from "../../context/AuthContext";
import { getErrorMessage } from "../../utils/getErrorMessage";

const INITIAL_FORM = {
  leavePolicyId: "",
  startDate: "",
  endDate: "",
  isHalfDay: false,
  reason: "",
};

export default function ApplyLeaveModal({ onClose, onSuccess }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [policies, setPolicies] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [attachment, setAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [error, setError] = useState("");
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    commonApi
      .getLeavePolicies()
      .then((data) => setPolicies(data.policies))
      .catch(() => setError("Couldn't load the form options. Please try again."))
      .finally(() => setIsLoadingOptions(false));
  }, []);

  const selectedPolicy = policies.find((p) => String(p.id) === String(form.leavePolicyId));
  const isSingleDay = form.startDate && form.startDate === form.endDate;

  // Raw calendar-day span (not working days - we don't have weekend/holiday
  // data here). Just used to decide when to show the attachment prompt; the
  // backend recomputes the real working-day total and is authoritative.
  const rawSpanDays =
    form.startDate && form.endDate
      ? Math.round((new Date(form.endDate) - new Date(form.startDate)) / 86400000) + 1
      : 0;
  const needsAttachment =
    selectedPolicy?.attachmentRequiredAboveDays != null && rawSpanDays > selectedPolicy.attachmentRequiredAboveDays;

  // Some leave types (e.g. Sick Leave) can only be booked a limited number of
  // days ahead of today - cap the date pickers to match. Skipped for policies
  // that let a supporting document lift that window (the attachment section
  // below guides them instead), since the backend enforces the real rule
  // either way.
  const policyMaxDate =
    selectedPolicy?.maxAdvanceBookingDays != null && selectedPolicy?.attachmentRequiredAboveDays == null
      ? new Date(Date.now() + selectedPolicy.maxAdvanceBookingDays * 86400000).toISOString().slice(0, 10)
      : undefined;
  const earliestOf = (...dates) => dates.filter(Boolean).sort()[0];
  const startMax = earliestOf(form.endDate, policyMaxDate);
  const endMax = policyMaxDate;

  const handleChange = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;

    setAttachmentError("");
    setIsUploadingAttachment(true);
    try {
      const data = await employeeLeaveApi.uploadAttachment(file);
      setAttachment(data);
    } catch (err) {
      setAttachmentError(getErrorMessage(err, "Couldn't upload this file. Please try again."));
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.leavePolicyId || !form.startDate || !form.endDate || !form.reason.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    if (needsAttachment && !attachment) {
      setError("Please upload a supporting document for this request.");
      return;
    }

    setIsSubmitting(true);
    try {
      await employeeLeaveApi.applyLeave({
        leavePolicyId: Number(form.leavePolicyId),
        startDate: form.startDate,
        endDate: form.endDate,
        isHalfDay: isSingleDay ? form.isHalfDay : false,
        reason: form.reason.trim(),
        attachmentUrl: attachment?.attachmentUrl,
      });
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't submit your leave request. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Apply for leave" onClose={onClose}>
      <Alert type="error">{error}</Alert>

      {isLoadingOptions ? (
        <p className="helper-text">Loading form options…</p>
      ) : !user?.managerId ? (
        <>
          <Alert type="error">
            You haven't set a manager yet. Please set one in your profile before applying for leave.
          </Alert>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                onClose();
                navigate("/profile");
              }}
            >
              Go to profile
            </Button>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <p className="helper-text" style={{ marginTop: 0 }}>
            This request will be sent to <strong>{user.manager?.firstName} {user.manager?.lastName}</strong> for approval.
          </p>

          <FormSelect label="Leave type" value={form.leavePolicyId} onChange={handleChange("leavePolicyId")}>
            <option value="" hidden></option>
            {policies.map((policy) => (
              <option key={policy.id} value={policy.id}>
                {policy.leaveName}
              </option>
            ))}
          </FormSelect>

          <div className="form-two-col">
            <TextInput
              label="Start date"
              type="date"
              value={form.startDate}
              max={startMax}
              onChange={handleChange("startDate")}
            />
            <TextInput
              label="End date"
              type="date"
              value={form.endDate}
              min={form.startDate || undefined}
              max={endMax}
              onChange={handleChange("endDate")}
            />
          </div>

          {selectedPolicy?.maxAdvanceBookingDays != null && (
            <p className="helper-text" style={{ marginTop: -12 }}>
              {selectedPolicy.leaveName} can only be requested for{" "}
              {selectedPolicy.maxAdvanceBookingDays === 1 ? "today or tomorrow" : `today or the next ${selectedPolicy.maxAdvanceBookingDays} day(s)`}
              {selectedPolicy.attachmentRequiredAboveDays != null ? " without a supporting document" : ""}.
            </p>
          )}

          {selectedPolicy?.longRequestThresholdDays != null && (
            <p className="helper-text" style={{ marginTop: -12 }}>
              {selectedPolicy.leaveName} requests longer than {selectedPolicy.longRequestThresholdDays} day(s) need at
              least {selectedPolicy.longRequestMinNoticeDays} days' advance notice.
            </p>
          )}

          {needsAttachment && (
            <div className="field">
              <label className="field-label">Supporting document</label>

              {attachment ? (
                <div className="attachment-uploaded-row">
                  <FileCheck size={16} />
                  <span>{attachment.fileName}</span>
                  <button type="button" className="link-btn" onClick={() => setAttachment(null)}>
                    Remove
                  </button>
                </div>
              ) : (
                <input
                  type="file"
                  className="field-input"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  disabled={isUploadingAttachment}
                />
              )}

              {isUploadingAttachment && (
                <p className="helper-text" style={{ marginTop: 0 }}>
                  Uploading…
                </p>
              )}
              {attachmentError && <Alert type="error">{attachmentError}</Alert>}

              <p className="helper-text" style={{ marginTop: 0 }}>
                <Paperclip size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                {selectedPolicy.leaveName} requests longer than {selectedPolicy.attachmentRequiredAboveDays} day(s)
                require a supporting document (PDF, JPEG, or PNG, max 2MB) - up to{" "}
                {selectedPolicy.maxLeavesPerRequestWithAttachment} day(s) with one attached.
              </p>
            </div>
          )}

          {isSingleDay && selectedPolicy?.allowHalfDay && (
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isHalfDay} onChange={handleChange("isHalfDay")} />
              Half-day leave
            </label>
          )}

          <TextArea
            label="Reason"
            placeholder="Briefly describe the reason for your leave"
            value={form.reason}
            onChange={handleChange("reason")}
          />

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Submit request
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
