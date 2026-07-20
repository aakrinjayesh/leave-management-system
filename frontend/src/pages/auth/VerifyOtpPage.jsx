import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../../components/layout/AuthLayout";
import OtpInput from "../../components/common/OtpInput";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as authApi from "../../api/auth.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { useAuth } from "../../context/AuthContext";
import { getDashboardPath } from "../../utils/roleRoutes";
import "./Auth.css";

const RESEND_COOLDOWN_SECONDS = 30;

const PURPOSE_COPY = {
  LOGIN: {
    title: "Confirm it's you",
    verify: authApi.loginOtpVerify,
  },
  REGISTER: {
    title: "Verify your email",
    verify: authApi.activateVerifyOtp,
    nextPath: "/activate/set-password",
  },
  FORGOT_PASSWORD: {
    title: "Verify your email",
    verify: authApi.forgotPasswordVerifyOtp,
    nextPath: "/reset-password",
  },
};

export default function VerifyOtpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { loginSession } = useAuth();

  const { flowToken, purpose, email } = location.state || {};

  const [currentFlowToken, setCurrentFlowToken] = useState(flowToken);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  const copy = PURPOSE_COPY[purpose];

  useEffect(() => {
    if (!flowToken || !copy) {
      navigate("/login", { replace: true });
    }
  }, [flowToken, copy, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (!flowToken || !copy) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (otp.length !== 6) {
      setError("Enter the 6-digit code sent to your email.");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await copy.verify({ flowToken: currentFlowToken, otp });

      if (purpose === "LOGIN") {
        loginSession(data.accessToken, data.user);
        navigate(getDashboardPath(data.user), { replace: true });
        return;
      }

      navigate(copy.nextPath, { state: { flowToken: data.flowToken }, replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Incorrect code. Please try again."));
      setOtp("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setIsResending(true);
    try {
      const data = await authApi.resendOtp({ flowToken: currentFlowToken });
      setCurrentFlowToken(data.flowToken);
      setOtp("");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't resend the code. Please try again."));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout title={copy.title} subtitle="Enter the 6-digit verification code we emailed you.">
      <p className="otp-meta">
        Code sent to <strong>{email || "your email"}</strong>
      </p>

      <Alert type="error">{error}</Alert>

      <form onSubmit={handleSubmit} noValidate>
        <OtpInput value={otp} onChange={setOtp} error={Boolean(error)} disabled={isSubmitting} />

        <Button type="submit" isLoading={isSubmitting} className="otp-submit-btn">
          Verify
        </Button>
      </form>

      <div className="otp-resend-row">
        {cooldown > 0 ? (
          <span>Resend code in {cooldown}s</span>
        ) : (
          <button type="button" className="link-btn" onClick={handleResend} disabled={isResending}>
            {isResending ? "Sending..." : "Resend code"}
          </button>
        )}
      </div>
    </AuthLayout>
  );
}
