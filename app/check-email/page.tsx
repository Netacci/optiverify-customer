"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import axios, { AxiosError } from "axios";
import toast from "react-hot-toast";

function CheckEmailPageContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!email) return;

    setResending(true);

    try {
      // Handle potential inconsistency in API_URL env var (whether it includes /api or not)
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const apiUrl = baseUrl.endsWith("/api") ? baseUrl : `${baseUrl}/api`;

      console.log(
        "Resending verification to:",
        `${apiUrl}/auth/resend-verification`
      );
      await axios.post(`${apiUrl}/auth/resend-verification`, {
        email,
      });
      toast.success("Verification email resent!");
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      console.error("Failed to resend email:", axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to resend email"
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Check Your Email
        </h1>
        <p className="text-gray-600 mb-6">
          We&apos;ve sent a verification link to <strong>{email}</strong>.
          Please check your inbox and click the link to verify your account and
          set your password.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Didn&apos;t receive the email? Check your spam folder.
        </p>

        <button
          onClick={handleResend}
          disabled={resending || !email}
          className="text-blue-600 hover:text-blue-800 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed underline mb-6 block w-full"
        >
          {resending ? "Resending..." : "Resend verification email"}
        </button>

        <div className="border-t border-gray-100 pt-6">
          <Link
            href="/login"
            className="text-gray-500 hover:text-gray-700 font-medium text-sm"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading...</p>
          </div>
        </div>
      }
    >
      <CheckEmailPageContent />
    </Suspense>
  );
}
