import { useId } from "react";
import "./TextInput.css";

export default function FormSelect({ label, error, children, ...selectProps }) {
  const id = useId();

  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="field-input-wrap">
        <select id={id} className={`field-input ${error ? "has-error" : ""}`.trim()} {...selectProps}>
          {children}
        </select>
      </div>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
