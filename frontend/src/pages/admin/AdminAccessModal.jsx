import { useState } from "react";
import Modal from "../../components/common/Modal";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";

// Confirms before granting or revoking Admin access, since it's a real
// privilege change - the backend guards against removing the last admin or
// an admin changing their own access, but this still asks first either way.
export default function AdminAccessModal({ user, grant, onClose, onSuccess }) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setError("");
    setIsSubmitting(true);
    try {
      await adminApi.setAdminAccess(user.id, grant);
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't update admin access. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={grant ? "Grant admin access" : "Remove admin access"} onClose={onClose}>
      <Alert type="error">{error}</Alert>

      <p className="helper-text" style={{ marginTop: 0 }}>
        {grant ? (
          <>
            <strong>
              {user.firstName} {user.lastName}
            </strong>{" "}
            will get full admin access - Manage Accounts, Reports, Payslips, and every other admin page.
          </>
        ) : (
          <>
            <strong>
              {user.firstName} {user.lastName}
            </strong>{" "}
            will lose admin access and go back to a regular Employee account. If people still report to them, they'll
            keep their manager access.
          </>
        )}
      </p>

      <div className="modal-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={handleConfirm} isLoading={isSubmitting}>
          {grant ? "Grant admin access" : "Remove admin access"}
        </Button>
      </div>
    </Modal>
  );
}
