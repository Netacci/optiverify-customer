import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { verifyEmail } from "@/api";
import toast from "react-hot-toast";
import { AxiosError } from "axios";
import Head from "next/head";

export default function VerifyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Guard so the verification effect runs at most once even under React 18+
  // strict-mode double invocation. Without this, the second invocation would
  // see a scrubbed URL with no token.
  const ranRef = useRef(false);

  // Capture token + email from URL once and immediately scrub the URL so the
  // secrets do not leak via Referer headers, browser history, or
  // shoulder-surfing. Runs once when router is ready.
  useEffect(() => {
    if (!router.isReady) return;
    if (ranRef.current) return;
    ranRef.current = true;

    const tokenParam = router.query.token;
    const emailParam = router.query.email;
    const token = typeof tokenParam === "string" ? tokenParam : "";
    const email = typeof emailParam === "string" ? emailParam : "";

    // Scrub query params from the URL bar / history / referer before doing
    // anything async. The verification call itself uses the local copies.
    router.replace(router.pathname, undefined, { shallow: true });

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
            // New user or user without password - redirect to create password.
            // Note: the create-password page will itself scrub these params on
            // mount, so they live in the URL only for the brief navigation.
            toast.success("Email verified! Please create your password.");
            router.push(
              `/create-password?token=${encodeURIComponent(
                token
              )}&email=${encodeURIComponent(email)}`
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  if (loading) {
    return (
      <>
        <Head>
          <title>Verifying Email - Optiverifi</title>
        </Head>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Verifying your email...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Head>
          <title>Verification Failed - Optiverifi</title>
        </Head>
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
      </>
    );
  }

  return null;
}

