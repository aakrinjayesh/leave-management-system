import { useId } from "react";
import "./TextInput.css";

export default function TextArea({ label, error, rows = 3, ...textareaProps }) {
  const id = useId();

  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      )}
      <textarea
        id={id}
        rows={rows}
        className={`field-input ${error ? "has-error" : ""}`.trim()}
        style={{ resize: "vertical" }}
        {...textareaProps}
      />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
