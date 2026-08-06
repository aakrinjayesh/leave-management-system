import { X } from "lucide-react";
import "./Modal.css";

export default function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay">
      <div className="modal-panel">
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
