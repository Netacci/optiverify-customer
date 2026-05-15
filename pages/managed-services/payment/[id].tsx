import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import Head from "next/head";
import Cookies from "js-cookie";

// Same-origin via Next.js rewrites (next.config.ts). API calls use relative
// paths (/api/...) and Next.js proxies them to the backend.

export default function ManagedServicePaymentPage() {
  const router = useRouter();
  const id = router.query.id as string;
  const [requestId, setRequestId] = useState<string>("");
  // `fee` is display-only. The backend computes the authoritative amount from
  // the request record server-side — never trust this value for billing.
  const [fee, setFee] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;

    setRequestId(id || "");
    const feeParam = router.query.fee as string;
    setFee(feeParam || "199");
    setLoading(false);
  }, [router.isReady, router.query, id]);

  const handlePayment = async () => {
    if (!requestId) {
      toast.error("Request ID is missing");
      return;
    }

    setIsSubmitting(true);

    try {
      toast.loading("Processing payment...", { id: "payment" });

      const token = Cookies.get("cd-token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // The backend (Wave 2A2) ignores client-supplied `amount`, `email`, and
      // `userId` and derives them from the request record + authenticated
      // session. Trusting client values would let users underpay or attribute
      // payments to other accounts. (Audit finding H-3.)
      const response = await fetch(
        `/api/managed-services/payment/create-session`,
        {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ requestId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create payment session");
      }

      if (data.success && data.data?.url) {
        toast.success("Redirecting to payment...", { id: "payment" });
        window.location.href = data.data.url;
      } else {
        throw new Error("No payment URL received");
      }
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("Failed to process payment");
      console.error("Payment error:", err);
      toast.error(err.message || "Failed to process payment", {
        id: "payment",
      });
      setIsSubmitting(false);
    }
  };

  if (loading || !router.isReady) {
    return (
      <>
        <Head>
          <title>Payment - Optiverifi</title>
        </Head>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Complete Payment - Optiverifi</title>
      </Head>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Complete Your Payment
            </h1>
            <p className="text-gray-600">
              Pay the service fee to start your managed sourcing request
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-medium text-gray-700">
                Service Fee
              </span>
              <span className="text-2xl font-bold text-blue-700">${fee}</span>
            </div>
            <p className="text-sm text-gray-600">
              This fee covers our initial research, supplier verification, and
              RFQ/RFP preparation.
            </p>
          </div>

          {/*
            Email input removed: the backend now uses the authenticated user's
            email server-side. Letting the user type a different address here
            allowed receipts to be misrouted and has no legitimate use.
          */}

          <div className="space-y-4">
            <button
              onClick={handlePayment}
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Processing...
                </>
              ) : (
                `Pay $${fee} with Stripe`
              )}
            </button>
            <button
              onClick={() => router.back()}
              className="w-full bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Go Back
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-6">
            Secure payment processed by Stripe
          </p>
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
