import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import AuthLayout from "../../components/layout/AuthLayout";
import TextInput from "../../components/common/TextInput";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as authApi from "../../api/auth.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import "./Auth.css";

const PASSWORD_HINT = "At least 8 characters, with a letter and a number.";

export default function ActivateSetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { flowToken } = location.state || {};

  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!flowToken) navigate("/activate", { replace: true });
  }, [flowToken, navigate]);

  if (!flowToken) return null;

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const errors = {};
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      errors.password = PASSWORD_HINT;
    }
    if (form.password !== form.confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await authApi.activateSetPassword({ flowToken, ...form });
      navigate("/login", { replace: true, state: { activated: true } });
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't set your password. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Set your password" subtitle="Choose a password to finish activating your account.">
      <Alert type="error">{error}</Alert>

      <form onSubmit={handleSubmit} noValidate>
        <TextInput
          label="New password"
          icon={<Lock size={17} />}
          isPassword
          placeholder="Enter a new password"
          value={form.password}
          onChange={handleChange("password")}
          error={fieldErrors.password}
          autoComplete="new-password"
        />
        <TextInput
          label="Confirm password"
          icon={<Lock size={17} />}
          isPassword
          placeholder="Re-enter your password"
          value={form.confirmPassword}
          onChange={handleChange("confirmPassword")}
          error={fieldErrors.confirmPassword}
          autoComplete="new-password"
        />

        <Button type="submit" isLoading={isSubmitting}>
          Activate account
        </Button>
      </form>
    </AuthLayout>
  );
}
