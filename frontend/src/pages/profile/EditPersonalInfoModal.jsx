import { useState } from "react";
import Modal from "../../components/common/Modal";
import TextInput from "../../components/common/TextInput";
import FormSelect from "../../components/common/FormSelect";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as profileApi from "../../api/profile.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import ProfileDocField from "./ProfileDocField";

const toDateInputValue = (date) => (date ? new Date(date).toISOString().slice(0, 10) : "");

export default function EditPersonalInfoModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    personalEmail: user?.personalEmail || "",
    phone: user?.phone || "",
    birthDate: toDateInputValue(user?.birthDate),
    gender: user?.gender || "",
    maritalStatus: user?.maritalStatus || "",
    fatherName: user?.fatherName || "",
    fatherMotherPhone: user?.fatherMotherPhone || "",
    spouseName: user?.spouseName || "",
    nationality: user?.nationality || "",
    qualification: user?.qualification || "",
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const isDirty =
    Boolean(photoFile) ||
    Object.keys(form).some((key) => {
      if (key === "birthDate") return form.birthDate !== toDateInputValue(user?.birthDate);
      return form[key] !== (user?.[key] || "");
    });

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      await profileApi.updateMyPersonalInfo(form, { photo: photoFile });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save your changes. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title="Edit Personal Information" onClose={onClose}>
      <Alert type="error">{error}</Alert>
      <form onSubmit={handleSubmit} noValidate>
        <p className="helper-text" style={{ marginTop: 0 }}>
          Name, employee code, and your work email can only be changed by your admin. Other changes take effect
          immediately.
        </p>

        <div className="form-two-col">
          <TextInput
            label="Personal email"
            type="email"
            placeholder="name@gmail.com"
            value={form.personalEmail}
            onChange={(e) => update("personalEmail", e.target.value)}
          />
          <TextInput
            label="Mobile number"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        </div>

        <div className="form-two-col">
          <TextInput
            label="Date of birth"
            type="date"
            max={toDateInputValue(new Date())}
            value={form.birthDate}
            onChange={(e) => update("birthDate", e.target.value)}
          />
          <FormSelect label="Gender" value={form.gender} onChange={(e) => update("gender", e.target.value)}>
            <option value="">Not set</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </FormSelect>
        </div>

        <div className="form-two-col">
          <FormSelect
            label="Marital status"
            value={form.maritalStatus}
            onChange={(e) => update("maritalStatus", e.target.value)}
          >
            <option value="">Not set</option>
            <option value="SINGLE">Single</option>
            <option value="MARRIED">Married</option>
            <option value="OTHER">Other</option>
          </FormSelect>
          <TextInput
            label="Father's name"
            value={form.fatherName}
            onChange={(e) => update("fatherName", e.target.value)}
          />
        </div>

        <div className="form-two-col">
          <TextInput
            label="Father/Mother Ph. number"
            value={form.fatherMotherPhone}
            onChange={(e) => update("fatherMotherPhone", e.target.value)}
          />
          <TextInput
            label="Spouse name"
            value={form.spouseName}
            onChange={(e) => update("spouseName", e.target.value)}
          />
        </div>

        <div className="form-two-col">
          <TextInput
            label="Nationality"
            value={form.nationality}
            onChange={(e) => update("nationality", e.target.value)}
          />
          <TextInput
            label="Qualification"
            value={form.qualification}
            onChange={(e) => update("qualification", e.target.value)}
          />
        </div>

        <ProfileDocField
          label="Profile picture"
          docType="photo"
          hasDocument={Boolean(user?.hasPhoto)}
          file={photoFile}
          onPick={setPhotoFile}
          accept=".jpg,.jpeg,.png"
        />

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving} disabled={!isDirty}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
