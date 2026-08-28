import axios from "axios";

// Relative by default so the browser only ever talks to one origin and the
// refresh-token cookie stays first-party. In prod the frontend host rewrites
// /api/* to the API service; in dev the Vite proxy does the same (vite.config.js).
const BASE_URL = import.meta.env.VITE_API_URL || "/api";

const axiosClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

let accessToken = null;
let onUnauthorized = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

// Registered by AuthContext so the interceptor can log the user out when a
// silent refresh ultimately fails (refresh token expired/revoked).
export const setOnUnauthorized = (handler) => {
  onUnauthorized = handler;
};

axiosClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise = null;

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = axiosClient
      .post("/auth/refresh-token")
      .then((res) => {
        const newToken = res.data.data.accessToken;
        setAccessToken(newToken);
        return newToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthRoute = originalRequest?.url?.startsWith("/auth/");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;
      try {
        const newToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        setAccessToken(null);
        if (onUnauthorized) onUnauthorized();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
