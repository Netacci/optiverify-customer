"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { verifyEmail } from "@/api";
import toast from "react-hot-toast";
import { AxiosError } from "axios";

function VerifyPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  useEffect(() => {
    const performVerification = async () => {
      if (!token || !email) {
        setError("Invalid verification link");
        toast.error("Invalid verification link");
        setLoading(false);
        return;
      }

      try {
        // Decode email to handle URL encoding
        const decodedEmail = decodeURIComponent(email);
        const response = await verifyEmail({ token, email: decodedEmail });

        if (response.success) {
          // Check if user has password
          if (
            response?.data?.hasPassword === false ||
            response?.data?.isNewUser
          ) {
            // New user or user without password - redirect to create password
            toast.success("Email verified! Please create your password.");
            router.push(
              `/create-password?token=${token}&email=${encodeURIComponent(
                email
              )}`
            );
          } else {
            // Existing user with password - redirect to login
            toast.success("Email verified! Please log in.");
            router.push("/login");
          }
        } else {
          setError(response.message || "Verification failed");
          toast.error(response.message || "Verification failed");
          setLoading(false);
        }
      } catch (err) {
        const error = err as AxiosError<{ message?: string }>;
        const errorMessage =
          error?.response?.data?.message || "Failed to verify email";
        setError(errorMessage);
        toast.error(errorMessage);
        setLoading(false);
      }
    };

    performVerification();
  }, [token, email, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying your email...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-4">
            <svg
              className="h-16 w-16 text-red-500 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Verification Failed
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export const dynamic = 'force-static';

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Verifying your email...</p>
          </div>
        </div>
      }
    >
      <VerifyPageContent />
    </Suspense>
  );
}
