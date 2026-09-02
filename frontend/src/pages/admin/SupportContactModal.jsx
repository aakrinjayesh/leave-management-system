import { useEffect, useState } from "react";
import { Mail, Phone, User } from "lucide-react";
import Modal from "../../components/common/Modal";
import Button from "../../components/common/Button";
import TextInput from "../../components/common/TextInput";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";

// Admin editor for the "We're here to assist you" contact shown on every
// dashboard's welcome banner. Stored on the single CompanySettings row and
// served to all users through /config, so a change here reaches everyone the
// next time they load a dashboard. Any field may be left blank - the banner
// just drops that row (and hides the whole card if all three are empty).
export default function SupportContactModal({ onClose, onSuccess }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    adminApi
      .getCompanySettings()
      .then((data) =>
        setForm({
          name: data.settings.supportContactName || "",
          email: data.settings.supportContactEmail || "",
          phone: data.settings.supportContactPhone || "",
        })
      )
      .catch((err) => setError(getErrorMessage(err, "Couldn't load the support contact.")));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      await adminApi.updateCompanySettings({
        supportContactName: form.name.trim(),
        supportContactEmail: form.email.trim(),
        supportContactPhone: form.phone.trim(),
      });
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the support contact. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title="Support contact" onClose={onClose}>
      <Alert type="error">{error}</Alert>

      {form === null ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
          <Spinner size={24} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <p className="helper-text">
            Shown as &ldquo;We&rsquo;re here to assist you&rdquo; on every dashboard. Changes reach all
            employees the next time they open their dashboard. Leave a field blank to hide that line.
          </p>

          <TextInput
            label="Name"
            icon={<User size={15} />}
            placeholder="e.g. Krishna Dadi"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Phone"
            icon={<Phone size={15} />}
            placeholder="e.g. +91 90000 00000"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <TextInput
            label="Email"
            icon={<Mail size={15} />}
            type="email"
            placeholder="e.g. krishna.dadi@aakrin.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Save changes
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
