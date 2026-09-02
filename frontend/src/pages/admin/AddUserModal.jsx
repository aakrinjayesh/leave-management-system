import { useState } from "react";
import Modal from "../../components/common/Modal";
import TextInput from "../../components/common/TextInput";
import FormSelect from "../../components/common/FormSelect";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";

const INITIAL_FORM = { firstName: "", lastName: "", email: "", employmentType: "" };

export default function AddUserModal({ onClose, onSuccess }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError("Please fill in first name, last name, and email.");
      return;
    }
    if (!form.employmentType) {
      setError("Please select an employment type.");
      return;
    }

    setIsSubmitting(true);
    try {
      await adminApi.createUser({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        // Interns and contractors are ordinary employee-permission accounts;
        // employmentType is only a label. Admin access is granted later via
        // the "Make admin" action on the account row.
        userType: "EMPLOYEE",
        employmentType: form.employmentType,
      });
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't create this account. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Add account" onClose={onClose}>
      <Alert type="error">{error}</Alert>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-two-col">
          <TextInput label="First name" value={form.firstName} onChange={handleChange("firstName")} />
          <TextInput label="Last name" value={form.lastName} onChange={handleChange("lastName")} />
        </div>

        <TextInput
          label="Email address"
          type="email"
          placeholder="firstname.lastname@aakrin.com"
          value={form.email}
          onChange={handleChange("email")}
        />
        <p className="helper-text" style={{ marginTop: 0 }}>
          Must be an @aakrin.com email, for every account type.
        </p>

        <FormSelect
          label="Employment type"
          value={form.employmentType}
          onChange={handleChange("employmentType")}
        >
          <option value="" hidden></option>
          <option value="EMPLOYEE">Employee</option>
          <option value="INTERN">Intern</option>
          <option value="CONTRACT">Hire to contract</option>
        </FormSelect>

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Create account
          </Button>
        </div>
      </form>
    </Modal>
  );
}
