import { publicRequest, authenticatedRequest } from "@/lib/requestMethod";
import Cookies from "js-cookie";

// Types
export interface VerifyEmailParams {
  token: string;
  email: string;
}

export interface CreatePasswordData {
  token: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    token?: string;
    user?: {
      id: string;
      email: string;
      name?: string;
    };
    // Fields specific to verify email response
    hasPassword?: boolean;
    isNewUser?: boolean;
    redirectUrl?: string;
  };
}

export interface UserResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      name?: string;
    };
  };
}

// API Functions

/**
 * Verify email with token
 */
export const verifyEmail = async (
  params: VerifyEmailParams
): Promise<AuthResponse> => {
  const response = await publicRequest.get<AuthResponse>(
    "/api/auth/verify-email",
    { params }
  );
  return response.data;
};

/**
 * Create password for new user
 */
export const createPassword = async (
  data: CreatePasswordData
): Promise<AuthResponse> => {
  const response = await publicRequest.post<AuthResponse>(
    "/api/auth/create-password",
    data
  );
  // Set cookie on successful password creation (customer token)
  if (response.data.data?.token) {
    Cookies.set("cd-token", response.data.data.token, { expires: 30 });
  }
  return response.data;
};

/**
 * Login user
 */
export const login = async (data: LoginData): Promise<AuthResponse> => {
  const response = await publicRequest.post<AuthResponse>(
    "/api/auth/login",
    data
  );
  // Set cookie on successful login (customer token)
  if (response.data.data?.token) {
    Cookies.set("cd-token", response.data.data.token, { expires: 30 });
  }
  return response.data;
};

/**
 * Logout user
 */
export const logout = async (): Promise<void> => {
  await authenticatedRequest.post("/api/auth/logout");
  Cookies.remove("cd-token");
};

/**
 * Request password reset
 */
export const forgotPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
  const response = await publicRequest.post<{ success: boolean; message: string }>(
    "/api/auth/forgot-password",
    { email }
  );
  return response.data;
};

/**
 * Reset password with token
 */
export const resetPassword = async (data: { token: string; email: string; password: string }): Promise<{ success: boolean; message: string }> => {
  const response = await publicRequest.post<{ success: boolean; message: string }>(
    "/api/auth/reset-password",
    data
  );
  return response.data;
};

/**
 * Get current user
 */
export const getCurrentUser = async (): Promise<UserResponse> => {
  const response = await authenticatedRequest.get<UserResponse>("/api/auth/me");
  return response.data;
};

/**
 * Change password
 */
export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export const changePassword = async (
  data: ChangePasswordData
): Promise<AuthResponse> => {
  const response = await authenticatedRequest.post<AuthResponse>(
    "/api/auth/change-password",
    data
  );
  return response.data;
};

