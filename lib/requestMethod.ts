import axios from "axios";
import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import Cookies from "js-cookie";

// Same-origin via Next.js rewrites (next.config.ts). Empty baseURL means
// axios builds relative URLs that go to the same host as this app; Next.js
// proxies /api/* to the backend server-side. Browser never sees the
// backend URL.
const BASE_URL = "";

export const publicRequest: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

export const authenticatedRequest: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Add Authorization header before each request
authenticatedRequest.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = Cookies.get("cd-token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }
);

// Handle 401 and 403 errors
authenticatedRequest.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Clear token
      Cookies.remove("cd-token");

      // Redirect to login if not already there
      if (typeof window !== "undefined") {
        const currentPath = window.location.pathname;
        if (
          currentPath !== "/login" &&
          currentPath !== "/verify" &&
          currentPath !== "/create-password"
        ) {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

