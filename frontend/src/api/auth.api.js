import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

export const login = ({ email, password }) => unwrap(axiosClient.post("/auth/login", { email, password }));

export const loginOtpSend = ({ email }) => unwrap(axiosClient.post("/auth/login/otp/send", { email }));

export const loginOtpVerify = ({ flowToken, otp }) =>
  unwrap(axiosClient.post("/auth/login/otp/verify", { flowToken, otp }));

export const resendOtp = ({ flowToken }) =>
  unwrap(axiosClient.post("/auth/otp/resend", { flowToken }));

export const activateSendOtp = ({ email, firstName, lastName }) =>
  unwrap(axiosClient.post("/auth/activate/send-otp", { email, firstName, lastName }));

export const activateVerifyOtp = ({ flowToken, otp }) =>
  unwrap(axiosClient.post("/auth/activate/verify-otp", { flowToken, otp }));

export const activateSetPassword = ({ flowToken, password, confirmPassword }) =>
  unwrap(axiosClient.post("/auth/activate/set-password", { flowToken, password, confirmPassword }));

export const forgotPasswordSendOtp = ({ email }) =>
  unwrap(axiosClient.post("/auth/forgot-password/send-otp", { email }));

export const forgotPasswordVerifyOtp = ({ flowToken, otp }) =>
  unwrap(axiosClient.post("/auth/forgot-password/verify-otp", { flowToken, otp }));

export const resetPassword = ({ flowToken, password, confirmPassword }) =>
  unwrap(axiosClient.post("/auth/reset-password", { flowToken, password, confirmPassword }));

export const refreshToken = () => unwrap(axiosClient.post("/auth/refresh-token"));

export const logout = () => unwrap(axiosClient.post("/auth/logout"));

export const getMe = () => unwrap(axiosClient.get("/auth/me"));
