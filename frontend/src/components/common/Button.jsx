import Spinner from "./Spinner";
import "./Button.css";

export default function Button({
  children,
  variant = "primary",
  isLoading = false,
  disabled = false,
  type = "button",
  onClick,
  className = "",
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${className}`.trim()}
      disabled={disabled || isLoading}
      onClick={onClick}
    >
      {isLoading && <Spinner size={16} />}
      {children}
    </button>
  );
}
