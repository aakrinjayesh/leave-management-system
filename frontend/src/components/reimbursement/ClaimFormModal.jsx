import { useState } from "react";
import { FileCheck, Paperclip, X } from "lucide-react";
import Modal from "../common/Modal";
import TextInput from "../common/TextInput";
import TextArea from "../common/TextArea";
import FormSelect from "../common/FormSelect";
import Button from "../common/Button";
import Alert from "../common/Alert";
import { getErrorMessage } from "../../utils/getErrorMessage";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.csv,.txt";
const MAX_FILES = 10;

// Shared "raise a reimbursement claim" form - used for an employee's own claim
// and for a manager/admin logging one on someone's behalf (pass `people` +
// require a selection). At least one file is mandatory.
export default function ClaimFormModal({ title, onClose, onSubmitted, submit, people = null }) {
  const [personId, setPersonId] = useState("");
  const [form, setForm] = useState({ subject: "", description: "", amount: "" });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const change = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const addFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    setFiles((prev) => [...prev, ...picked].slice(0, MAX_FILES));
  };
  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const amount = Number(form.amount);
    const missing = [];
    if (people && !personId) missing.push("who the claim is for");
    if (!form.subject.trim()) missing.push("subject");
    if (!(amount > 0)) missing.push("amount (greater than 0)");
    if (!form.description.trim()) missing.push("description");
    if (files.length === 0) missing.push("at least one supporting file");

    if (missing.length > 0) {
      setError(
        missing.length === 1
          ? `Please provide ${missing[0]}.`
          : `Please provide: ${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await submit({
        personId: personId ? Number(personId) : undefined,
        subject: form.subject.trim(),
        description: form.description.trim(),
        amount,
        files,
      });
      onSubmitted();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't submit this claim. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <Alert type="error">{error}</Alert>

      <form onSubmit={handleSubmit} noValidate>
        {people && (
          <FormSelect label="Whose claim is this?" value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="" hidden></option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </FormSelect>
        )}

        <TextInput
          label="Subject"
          placeholder="e.g. Client visit travel — Bengaluru"
          value={form.subject}
          onChange={change("subject")}
        />

        <TextInput label="Amount (₹)" type="number" min="0" step="0.01" value={form.amount} onChange={change("amount")} />

        <TextArea
          label="Description"
          placeholder="What was the expense for? Include anything the approver needs to know."
          rows={3}
          value={form.description}
          onChange={change("description")}
        />

        <div className="field">
          <label className="field-label">Supporting files (required)</label>
          {files.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              {files.map((file, idx) => (
                <div className="attachment-uploaded-row" key={`${file.name}-${idx}`}>
                  <FileCheck size={16} />
                  <span>{file.name}</span>
                  <button type="button" className="link-btn" onClick={() => removeFile(idx)} aria-label="Remove file">
                    <X size={13} style={{ verticalAlign: "-2px" }} /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          {files.length < MAX_FILES && (
            <label className="file-upload-box">
              <span className="file-upload-box-icon">
                <Paperclip size={16} />
              </span>
              <span className="file-upload-box-text">
                <strong>Click to add</strong> receipts / invoices
                <span className="file-upload-box-hint">PDF, image, Word, Excel · up to {MAX_FILES} files, 5MB each</span>
              </span>
              <input type="file" className="file-upload-input" accept={ACCEPT} multiple onChange={addFiles} />
            </label>
          )}
        </div>

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {people ? "Log & approve" : "Submit claim"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
