import { useRef } from "react";
import { Eye, Trash2, Upload } from "lucide-react";

export default function DocumentUploadField({
  label,
  hasDocument,
  isBusy,
  onUpload,
  onView,
  onRemove,
  accept = ".pdf,.jpg,.jpeg,.png",
}) {
  const inputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) onUpload(file);
    e.target.value = "";
  };

  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className={`status-badge status-badge-${hasDocument ? "active" : "inactive"}`}>
          {hasDocument ? "Uploaded" : "Not uploaded"}
        </span>
        <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }} onChange={handleFileChange} />
        <button type="button" className="row-action-btn" disabled={isBusy} onClick={() => inputRef.current.click()}>
          <Upload size={14} />
          {hasDocument ? "Replace" : "Upload"}
        </button>
        {hasDocument && (
          <>
            <button type="button" className="row-action-btn" disabled={isBusy} onClick={onView}>
              <Eye size={14} />
              View
            </button>
            <button type="button" className="row-action-btn reject" disabled={isBusy} onClick={onRemove}>
              <Trash2 size={14} />
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
}
