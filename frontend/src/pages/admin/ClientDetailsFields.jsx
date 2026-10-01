import { useState } from "react";
import TextInput from "../../components/common/TextInput";
import TextArea from "../../components/common/TextArea";
import FormSelect from "../../components/common/FormSelect";
import Alert from "../../components/common/Alert";
import DocumentUploadField from "./DocumentUploadField";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { INDIAN_STATES } from "../../utils/indianStates";

const DOC_ACCEPT = ".pdf,.jpg,.jpeg,.png,.doc,.docx";

// The 3 client documents that are just a single optional upload each - no
// typed value alongside them, unlike GST/PAN which pair a number with their
// own upload.
const OTHER_DOCS = [
  { type: "msme", field: "msmeDocumentUrl", label: "MSME certificate" },
  { type: "sow", field: "sowDocumentUrl", label: "SOW" },
  { type: "agreement", field: "agreementDocumentUrl", label: "Agreement" },
];

// Shared "Client / company details" block used by both the New Project form
// and Edit Project modal - a brand-new project (not saved yet) and an
// existing one both just need `form` + `onFieldChange`, since documents
// upload to a generic, project-id-less endpoint and the resulting URL is
// only attached to the project once the surrounding form is submitted.
// Admin-only: none of this is ever sent to an employee's own timesheet.
export default function ClientDetailsFields({ form, onFieldChange }) {
  const [uploadError, setUploadError] = useState("");
  const [busyType, setBusyType] = useState(null);

  // Only makes sense for a Client Project - an internal project has no
  // client to have GST/PAN/an agreement with. Hidden (not cleared) if
  // switched to Internal after some of this was already filled in, so
  // nothing is lost by flipping the type back and forth.
  if (form.projectType !== "ASSIGNED") return null;

  const change = (field) => (e) => onFieldChange(field, e.target.value);

  const handleUpload = async (type, field, file) => {
    setUploadError("");
    setBusyType(type);
    try {
      const { url } = await adminApi.uploadProjectDocument(type, file);
      onFieldChange(field, url);
    } catch (err) {
      setUploadError(getErrorMessage(err, "Couldn't upload this file."));
    } finally {
      setBusyType(null);
    }
  };

  const handleView = (field) => {
    if (form[field]) window.open(form[field], "_blank", "noopener,noreferrer");
  };

  const handleRemove = (field) => onFieldChange(field, "");

  // A number + its own upload, grouped in one bordered block so they read as
  // a single field ("GST", "PAN") instead of two unrelated grid cells.
  const renderNumberWithDoc = ({ groupLabel, numberLabel, numberField, placeholder, type, docField, docLabel }) => (
    <div className="client-doc-group">
      <span className="client-doc-group-title">{groupLabel}</span>
      <div className="form-two-col" style={{ margin: 0 }}>
        <TextInput
          label={numberLabel}
          placeholder={placeholder}
          value={form[numberField] || ""}
          onChange={change(numberField)}
        />
        <DocumentUploadField
          label={docLabel}
          hasDocument={Boolean(form[docField])}
          isBusy={busyType === type}
          onUpload={(file) => handleUpload(type, docField, file)}
          onView={() => handleView(docField)}
          onRemove={() => handleRemove(docField)}
          accept={DOC_ACCEPT}
        />
      </div>
    </div>
  );

  return (
    <>
      <hr className="modal-section-divider" />
      <p className="modal-section-title">Client / company details</p>
      <p className="helper-text" style={{ marginTop: -8 }}>
        Optional, admin-only - never shown to employees on their timesheet. Can be left blank now and filled in later.
      </p>

      <Alert type="error">{uploadError}</Alert>

      <div className="form-three-col">
        <TextInput
          label="Full name of the client"
          placeholder="e.g. Acme Corporation Pvt Ltd"
          value={form.clientFullName || ""}
          onChange={change("clientFullName")}
        />
        <TextInput
          label="Payment terms"
          placeholder="e.g. Net 30"
          value={form.paymentTerms || ""}
          onChange={change("paymentTerms")}
        />
        <TextInput
          label="Rate card"
          placeholder="e.g. ₹X/hr onsite, ₹Y/hr offshore"
          value={form.rateCard || ""}
          onChange={change("rateCard")}
        />
      </div>

      <TextArea
        label="Address of the client"
        placeholder="Registered / billing address"
        rows={2}
        value={form.clientAddress || ""}
        onChange={change("clientAddress")}
      />

      <div className="form-two-col">
        <FormSelect label="State" value={form.clientState || ""} onChange={change("clientState")}>
          <option value="" hidden></option>
          {INDIAN_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </FormSelect>
      </div>
      <p className="helper-text" style={{ marginTop: -8 }}>
        Drives the GST place of supply on invoices generated for this client - same state as Aakrin (Karnataka)
        charges CGST+SGST, any other state charges IGST.
      </p>

      {renderNumberWithDoc({
        groupLabel: "GST",
        numberLabel: "GST number",
        numberField: "gstNumber",
        placeholder: "e.g. 22AAAAA0000A1Z5",
        type: "gst",
        docField: "gstDocumentUrl",
        docLabel: "GST document (optional)",
      })}

      {renderNumberWithDoc({
        groupLabel: "PAN",
        numberLabel: "PAN number",
        numberField: "panNumber",
        placeholder: "e.g. AAAAA9999A",
        type: "pan",
        docField: "panDocumentUrl",
        docLabel: "PAN document (optional)",
      })}

      <div className="client-doc-group">
        <span className="client-doc-group-title">Other documents</span>
        <div className="form-three-col" style={{ margin: 0 }}>
          {OTHER_DOCS.map(({ type, field, label }) => (
            <DocumentUploadField
              key={type}
              label={label}
              hasDocument={Boolean(form[field])}
              isBusy={busyType === type}
              onUpload={(file) => handleUpload(type, field, file)}
              onView={() => handleView(field)}
              onRemove={() => handleRemove(field)}
              accept={DOC_ACCEPT}
            />
          ))}
        </div>
      </div>
    </>
  );
}
