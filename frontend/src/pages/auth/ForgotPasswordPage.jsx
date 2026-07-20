import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import AuthLayout from "../../components/layout/AuthLayout";
import TextInput from "../../components/common/TextInput";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as authApi from "../../api/auth.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import "./Auth.css";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const data = await authApi.forgotPasswordSendOtp({ email: trimmedEmail });
      navigate("/verify-otp", {
        state: { flowToken: data.flowToken, purpose: "FORGOT_PASSWORD", email: trimmedEmail },
      });
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't send a reset code. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your account email and we'll send you a verification code."
    >
      <Alert type="error">{error}</Alert>

      <form onSubmit={handleSubmit} noValidate>
        <TextInput
          label="Email address"
          icon={<Mail size={17} />}
          placeholder="you@aakrin.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <Button type="submit" isLoading={isSubmitting}>
          Send verification code
        </Button>
      </form>

      <p className="auth-card-footer">
        Remembered your password?{" "}
        <button type="button" className="link-btn" onClick={() => navigate("/login")}>
          Log in
        </button>
      </p>
    </AuthLayout>
  );
}
