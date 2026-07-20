import "./StatusBadge.css";

export default function StatusBadge({ status }) {
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return <span className={`status-badge status-badge-${status.toLowerCase()}`}>{label}</span>;
}
