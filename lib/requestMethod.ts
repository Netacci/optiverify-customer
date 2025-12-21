import axios from "axios";
import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import Cookies from "js-cookie";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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
    console.log(`[authenticatedRequest] Making ${config.method?.toUpperCase()} request to: ${config.baseURL}${config.url}`);
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

