import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import AuthLayout from "../../components/layout/AuthLayout";
import TextInput from "../../components/common/TextInput";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as authApi from "../../api/auth.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { useAuth } from "../../context/AuthContext";
import { getDashboardPath } from "../../utils/roleRoutes";
import "./Auth.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginSession } = useAuth();
  const [method, setMethod] = useState("PASSWORD");
  const [form, setForm] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const successMessage = location.state?.activated
    ? "Account activated! You can now log in."
    : location.state?.passwordReset
      ? "Password reset! You can now log in with your new password."
      : "";

  const handleMethodChange = (nextMethod) => {
    setMethod(nextMethod);
    setError("");
    setFieldErrors({});
  };

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const errors = {};
    if (!form.email.trim()) {
      errors.email = "Email is required.";
    }
    if (method === "PASSWORD" && !form.password) {
      errors.password = "Password is required.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    const email = form.email.trim().toLowerCase();
    setIsSubmitting(true);
    try {
      if (method === "PASSWORD") {
        const data = await authApi.login({ email, password: form.password });
        loginSession(data.accessToken, data.user);
        navigate(getDashboardPath(data.user), { replace: true });
      } else {
        const data = await authApi.loginOtpSend({ email });
        navigate("/verify-otp", { state: { flowToken: data.flowToken, purpose: "LOGIN", email } });
      }
    } catch (err) {
      setError(getErrorMessage(err, "Unable to log in. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to manage your leave requests and approvals.">
      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={method === "PASSWORD"}
          className={`tab-btn ${method === "PASSWORD" ? "active" : ""}`}
          onClick={() => handleMethodChange("PASSWORD")}
        >
          Password
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={method === "OTP"}
          className={`tab-btn ${method === "OTP" ? "active" : ""}`}
          onClick={() => handleMethodChange("OTP")}
        >
          Email OTP
        </button>
      </div>

      {!error && <Alert type="success">{successMessage}</Alert>}
      <Alert type="error">{error}</Alert>

      <form onSubmit={handleSubmit} noValidate>
        <TextInput
          label="Email address"
          icon={<Mail size={17} />}
          placeholder="you@aakrin.com"
          value={form.email}
          onChange={handleChange("email")}
          error={fieldErrors.email}
          autoComplete="email"
        />

        {method === "PASSWORD" && (
          <TextInput
            label="Password"
            icon={<Lock size={17} />}
            isPassword
            placeholder="Enter your password"
            value={form.password}
            onChange={handleChange("password")}
            error={fieldErrors.password}
            autoComplete="current-password"
          />
        )}

        {method === "PASSWORD" && (
          <div className="field-row-between">
            <button type="button" className="link-btn" onClick={() => navigate("/forgot-password")}>
              Forgot password?
            </button>
          </div>
        )}

        <Button type="submit" isLoading={isSubmitting}>
          {method === "PASSWORD" ? "Continue" : "Send verification code"}
        </Button>
      </form>

      <p className="auth-card-footer">
        First time here?{" "}
        <button type="button" className="link-btn" onClick={() => navigate("/activate")}>
          Create your account
        </button>
      </p>
    </AuthLayout>
  );
}
