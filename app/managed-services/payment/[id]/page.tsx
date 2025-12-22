"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function ManagedServicePaymentPageContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [requestId, setRequestId] = useState<string>("");
  const [fee, setFee] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params;
      setRequestId(resolvedParams.id);
      const feeParam = searchParams.get("fee");
      const emailParam = searchParams.get("email");
      setFee(feeParam || "199");
      setEmail(emailParam || "");
      setLoading(false);
    };
    getParams();
  }, [params, searchParams]);

  const handlePayment = async () => {
    if (!requestId) {
      toast.error("Request ID is missing");
      return;
    }

    if (!email || !email.trim()) {
      toast.error("Please enter your email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      toast.loading("Processing payment...", { id: "payment" });

      // Call backend to create Stripe checkout session
      const response = await fetch(
        `${API_URL}/api/managed-services/payment/create-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            requestId,
            amount: parseFloat(fee) * 100, // Convert to cents
            email: email.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create payment session");
      }

      if (data.success && data.data?.url) {
        toast.success("Redirecting to payment...", { id: "payment" });
        // Redirect to Stripe checkout
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
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
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
            This fee covers our initial research, supplier verification, and RFQ
            preparation.
          </p>
        </div>

        <div className="mb-6">
          <label
            htmlFor="email"
            className="block text-sm font-semibold text-gray-900 mb-2"
          >
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-base transition-all border-gray-200"
          />
        </div>

        <div className="space-y-4">
          <button
            onClick={handlePayment}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Pay ${fee} with Stripe
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
  );
}

export default function ManagedServicePaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <ManagedServicePaymentPageContent params={params} />
    </Suspense>
  );
}
