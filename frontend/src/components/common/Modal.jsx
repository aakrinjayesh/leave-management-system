import { X } from "lucide-react";
import "./Modal.css";

// `wide` opts into a roomier max-width for modals with denser content (e.g.
// EditProjectModal's schedule fields) - the default stays unchanged for every
// simpler modal (confirmations, single-field forms). `full` is a large panel
// that fills the content area (leaving the sidebar + top bar visible), for
// list-heavy screens like "Manage members". `headerActions` renders extra
// controls (buttons) next to the close button.
export default function Modal({
  title,
  onClose,
  children,
  wide = false,
  full = false,
  headerActions = null,
}) {
  const sizeClass = full ? "modal-panel-full" : wide ? "modal-panel-wide" : "";

  return (
    <div className={`modal-overlay ${full ? "modal-overlay-full" : ""}`.trim()}>
      <div className={`modal-panel ${sizeClass}`.trim()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <div className="modal-header-actions">
            {headerActions}
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
