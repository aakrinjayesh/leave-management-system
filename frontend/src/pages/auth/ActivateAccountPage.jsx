import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, User } from "lucide-react";
import AuthLayout from "../../components/layout/AuthLayout";
import TextInput from "../../components/common/TextInput";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as authApi from "../../api/auth.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import "./Auth.css";

const INITIAL_FORM = { firstName: "", lastName: "", email: "" };

export default function ActivateAccountPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const trimmedEmail = form.email.trim().toLowerCase();
      const data = await authApi.activateSendOtp({
        email: trimmedEmail,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      });
      navigate("/verify-otp", {
        state: { flowToken: data.flowToken, purpose: "REGISTER", email: trimmedEmail },
      });
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't create your account. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Employees can sign up with any @aakrin.com email. If you were added by an admin, just enter your details below to activate."
    >
      <Alert type="error">{error}</Alert>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-two-col">
          <TextInput
            label="First name"
            icon={<User size={17} />}
            value={form.firstName}
            onChange={handleChange("firstName")}
            autoComplete="given-name"
          />
          <TextInput
            label="Last name"
            icon={<User size={17} />}
            value={form.lastName}
            onChange={handleChange("lastName")}
            autoComplete="family-name"
          />
        </div>

        <TextInput
          label="Email address"
          icon={<Mail size={17} />}
          placeholder="you@aakrin.com"
          value={form.email}
          onChange={handleChange("email")}
          autoComplete="email"
        />

        <Button type="submit" isLoading={isSubmitting}>
          Send verification code
        </Button>
      </form>

      <p className="auth-card-footer">
        Already activated?{" "}
        <button type="button" className="link-btn" onClick={() => navigate("/login")}>
          Log in
        </button>
      </p>
    </AuthLayout>
  );
}
