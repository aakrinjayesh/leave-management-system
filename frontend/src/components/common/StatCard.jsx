import "./StatCard.css";

export default function StatCard({ icon, label, value, onClick }) {
  return (
    <div className={`stat-card ${onClick ? "is-clickable" : ""}`.trim()} onClick={onClick}>
      <span className="stat-card-icon">{icon}</span>
      <div className="stat-card-body">
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
      </div>
    </div>
  );
}
