import { X } from "lucide-react";
import "./Modal.css";

// `wide` opts into a roomier max-width for modals with denser content (e.g.
// EditProjectModal's schedule fields, the manage-members list) - the default
// stays unchanged for every simpler modal (confirmations, single-field forms).
export default function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="modal-overlay">
      <div className={`modal-panel ${wide ? "modal-panel-wide" : ""}`.trim()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
