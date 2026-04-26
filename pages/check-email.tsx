import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import axios, { AxiosError } from "axios";
import toast from "react-hot-toast";
import Head from "next/head";

export default function CheckEmailPage() {
  const router = useRouter();

  // Capture email from the URL into component state, then scrub the address
  // bar so PII does not persist in browser history, server access logs, or
  // the Referer header on outbound requests. Same pattern Wave 2B1 / preview
  // funnel applied. We don't persist this in sessionStorage — it's a
  // terminal page in the flow and the value is only used for display.
  const [email, setEmail] = useState<string>("");
  const [resending, setResending] = useState(false);
  // Nuance for messaging: in dev, the Stripe webhook often doesn't fire
  // (no `stripe listen` running), so the verification email isn't sent on
  // its own. We auto-trigger a resend on mount as a defense-in-depth so
  // the user actually receives the email even if the webhook failed.
  // The backend's resendVerification is rate-limited (authLimiter:
  // 20/15min) and constant-message anti-enumeration, so calling it on
  // every page load is safe.
  const autoSentRef = useRef(false);

  useEffect(() => {
    if (!router.isReady || autoSentRef.current) return;

    const emailParam =
      typeof router.query.email === "string" ? router.query.email : null;
    if (!emailParam) return;

    autoSentRef.current = true;
    const decoded = decodeURIComponent(emailParam);
    setEmail(decoded);

    // Scrub PII from the URL.
    router.replace("/check-email", undefined, { shallow: true });

    // Best-effort auto-resend. Failures are silent (the user can click the
    // resend button); we don't surface an error toast here since the
    // primary path is "the webhook already sent it and the user just
    // doesn't see it yet".
    axios
      .post(`/api/auth/resend-verification`, { email: decoded })
      .catch(() => {});
  }, [router.isReady, router.query.email, router]);

  const handleResend = async () => {
    if (!email) return;

    setResending(true);

    try {
      await axios.post(`/api/auth/resend-verification`, { email });
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
    <>
      <Head>
        <title>Check Your Email - Optiverifi</title>
      </Head>
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
          <p className="text-gray-600 mb-2">
            {email ? (
              <>
                A verification link is on its way to{" "}
                <strong>{email}</strong>.
              </>
            ) : (
              <>A verification link is on its way to your inbox.</>
            )}
          </p>
          <p className="text-gray-600 mb-6">
            Click the link in the email to verify your account and set your
            password.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Didn&apos;t receive the email within a minute? Check your spam
            folder, or use the link below.
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
    </>
  );
}
