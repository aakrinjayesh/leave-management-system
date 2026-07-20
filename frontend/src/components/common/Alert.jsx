import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import "./Alert.css";

const ICONS = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

export default function Alert({ type = "info", children }) {
  if (!children) return null;
  const Icon = ICONS[type] || Info;

  return (
    <div className={`alert alert-${type}`} role={type === "error" ? "alert" : "status"}>
      <Icon size={18} />
      <span>{children}</span>
    </div>
  );
}
