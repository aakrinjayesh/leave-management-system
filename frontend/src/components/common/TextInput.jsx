import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import "./TextInput.css";

export default function TextInput({
  label,
  icon,
  error,
  type = "text",
  isPassword = false,
  ...inputProps
}) {
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const resolvedType = isPassword ? (showPassword ? "text" : "password") : type;

  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="field-input-wrap">
        {icon && <span className="field-icon">{icon}</span>}
        <input
          id={id}
          type={resolvedType}
          className={`field-input ${icon ? "has-icon" : ""} ${isPassword ? "has-toggle" : ""} ${
            error ? "has-error" : ""
          }`.trim()}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            className="field-toggle"
            tabIndex={-1}
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
