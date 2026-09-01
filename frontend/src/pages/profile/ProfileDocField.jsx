import { useRef, useState } from "react";
import { Eye, Upload, X } from "lucide-react";
import * as profileApi from "../../api/profile.api";
import { openBlobInNewTab } from "../../utils/openBlob";
import { getErrorMessage } from "../../utils/getErrorMessage";

// One document slot inside a profile-section edit modal. The parent owns the
// selected File (via `onPick`); this just renders the picker + current status
// + a "view current" action. The actual upload happens when the modal is
// submitted, as part of the section change request.
export default function ProfileDocField({ label, docType, hasDocument, file, onPick, accept = ".pdf,.jpg,.jpeg,.png" }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");

  const viewCurrent = async () => {
    setError("");
    try {
      const res = await profileApi.downloadMyDocument(docType);
      openBlobInNewTab(res.data);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't open this document."));
    }
  };

  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {file ? (
          <span className="att-chip is-present" style={{ maxWidth: 220 }}>
            <span className="att-chip-dot" />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
          </span>
        ) : (
          <span className={`status-badge status-badge-${hasDocument ? "active" : "inactive"}`}>
            {hasDocument ? "Uploaded" : "Not uploaded"}
          </span>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          style={{ display: "none" }}
          onChange={(e) => {
            const picked = e.target.files[0];
            if (picked) onPick(picked);
            e.target.value = "";
          }}
        />
        <button type="button" className="row-action-btn" onClick={() => inputRef.current.click()}>
          <Upload size={14} />
          {file ? "Choose another" : hasDocument ? "Replace" : "Upload"}
        </button>

        {file && (
          <button type="button" className="row-action-btn reject" onClick={() => onPick(null)}>
            <X size={14} />
            Clear
          </button>
        )}
        {hasDocument && !file && (
          <button type="button" className="row-action-btn" onClick={viewCurrent}>
            <Eye size={14} />
            View current
          </button>
        )}
      </div>
      {file && <p className="helper-text" style={{ marginTop: 4 }}>This file will be sent to admin for approval.</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
