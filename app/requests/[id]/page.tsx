"use client";

import { use, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  getRequestDetails,
  getSubscriptionStatus,
  unlockRequest,
  createCheckoutSession,
  getCurrentUser,
  syncPaymentStatus,
  Supplier,
} from "@/api";
import { generateAIMatch } from "@/api/requests";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import toast from "react-hot-toast";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AxiosError } from "axios";
import { generateMatchReportPDF } from "@/utils/generatePDF";

function RequestDetailsPageContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const paymentSuccess = searchParams.get("payment");

  const { data: userData } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUser,
  });

  const { data: subData, refetch: refetchSub } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscriptionStatus,
  });

  const {
    data,
    isLoading,
    error,
    refetch: refetchRequest,
  } = useQuery({
    queryKey: ["requestDetails", id],
    queryFn: () => getRequestDetails(id),
    retry: false,
  });

  const request = data?.data?.request;
  const suppliers = data?.data?.suppliers || [];
  const isLocked = data?.data?.isLocked || false;
  const matchReportStatus = data?.data?.matchReportStatus || data?.data?.status;
  const isUnlocked = matchReportStatus === "unlocked"; // Show generate button when unlocked (after payment)
  const isPending = matchReportStatus === "pending"; // Show payment button when pending (no payment yet)

  // State to track if we are currently verifying payment to hide unlock button
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  // Sync payment status if redirecting from successful payment
  useEffect(() => {
    const syncPayment = async () => {
      if (paymentSuccess === "success" && isLocked) {
        setIsVerifyingPayment(true);
        const toastId = toast.loading("Verifying payment...");
        try {
          await syncPaymentStatus(id);
          toast.success("Payment verified! Unlocking report...", {
            id: toastId,
          });
          // Refetch data to update UI
          await Promise.all([refetchRequest(), refetchSub()]);

          // Remove the query param to prevent re-syncing
          router.replace(`/requests/${id}`);
        } catch (error) {
          console.error("Payment sync failed:", error);
          toast.error(
            "Could not verify payment automatically. Please contact support if this persists.",
            { id: toastId }
          );
        } finally {
          setIsVerifyingPayment(false);
        }
      }
    };

    syncPayment();
  }, [paymentSuccess, isLocked, id, refetchRequest, refetchSub, router]);

  const user = userData?.data?.user;
  const matchCredits = subData?.data?.matchCredits || 0;
  const isSubscribed = subData?.data?.subscriptionStatus === "active";

  // Pricing logic
  const payPerMatchPrice = isSubscribed ? 10 : 49;
  const planType = isSubscribed ? "extra_credit" : "one-time";
  const payPerMatchTitle = isSubscribed ? "Buy Extra Match" : "Pay Per Match";
  const payPerMatchDesc = isSubscribed
    ? "You're out of credits. Buy an extra match for just $10."
    : "One-time payment to unlock this specific match report forever.";

  const unlockMutation = useMutation({
    mutationFn: () => unlockRequest(id),
    onSuccess: () => {
      toast.success("Request unlocked!");
      refetchRequest();
      refetchSub();
    },
    onError: (err) => {
      const error = err as AxiosError<{ message?: string }>;
      toast.error(error?.response?.data?.message || "Failed to unlock");
    },
  });

  const paymentMutation = useMutation({
    mutationFn: createCheckoutSession,
    onSuccess: (data) => {
      if (data.data?.url) window.location.href = data.data.url;
    },
    onError: (err) => {
      const error = err as AxiosError<{ message?: string }>;
      toast.error(
        error?.response?.data?.message || "Failed to initiate payment"
      );
    },
  });

  const generateMatchMutation = useMutation({
    mutationFn: () => generateAIMatch(id),
    onSuccess: () => {
      toast.success("AI match generated successfully!");
      refetchRequest();
    },
    onError: (err) => {
      const error = err as AxiosError<{ message?: string }>;
      toast.error(
        error?.response?.data?.message || "Failed to generate AI match"
      );
    },
  });

  const handlePayUnlock = () => {
    if (!user?.email) {
      toast.error("User email not found");
      return;
    }
    paymentMutation.mutate({
      requestId: id,
      planType: planType,
      email: user.email,
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">
            Loading request details...
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (error && !isLocked) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto">
          <Link
            href="/requests"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <span>&larr; Back to Requests</span>
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <p className="text-red-600 font-medium">
              Failed to load request details
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isLocked) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto py-12 px-4">
          <Link
            href="/requests"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8"
          >
            <span>&larr; Back to Requests</span>
          </Link>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden text-center relative">
            <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-10 flex flex-col items-center justify-center p-8">
              {isPending ? (
                <>
                  {isVerifyingPayment ? (
                    <>
                      <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Verifying Payment
                      </h2>
                      <p className="text-gray-600 max-w-md mb-8">
                        Please wait while we verify your payment and unlock your
                        match report...
                      </p>
                      <div className="grid gap-4 w-full max-w-sm">
                        <div className="w-full py-3 px-6 bg-gray-100 text-gray-500 rounded-lg font-semibold flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                          Verifying...
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                        <svg
                          className="w-10 h-10 text-blue-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                          />
                        </svg>
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Make Payment
                      </h2>
                      <p className="text-gray-600 max-w-md mb-8">
                        Your request has been created. Complete your payment to
                        unlock your AI-powered match report with detailed
                        supplier analysis.
                      </p>

                      <div className="grid gap-4 w-full max-w-sm">
                        <button
                          onClick={() => {
                            router.push(`/payment-plans?requestId=${id}`);
                          }}
                          className="w-full py-3 px-6 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                        >
                          Make Payment
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : isUnlocked ? (
                <>
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                    <svg
                      className="w-10 h-10 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Generate AI Match
                  </h2>
                  <p className="text-gray-600 max-w-md mb-8">
                    Your payment has been processed. Click the button below to
                    generate your AI-powered match report with detailed supplier
                    analysis.
                  </p>

                  <div className="grid gap-4 w-full max-w-sm">
                    {!generateMatchMutation.isPending && (
                      <button
                        onClick={() => generateMatchMutation.mutate()}
                        className="w-full py-3 px-6 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                      >
                        Generate AI Match
                      </button>
                    )}
                    {generateMatchMutation.isPending && (
                      <div className="w-full py-3 px-6 bg-gray-100 text-gray-500 rounded-lg font-semibold flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                        Generating AI Match...
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                    <svg
                      className="w-10 h-10 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Unlock Your Match Report
                  </h2>
                  <p className="text-gray-600 max-w-md mb-8">
                    Get instant access to verified suppliers, contact details,
                    AI analysis, and negotiation tips for this request.
                  </p>

                  <div className="grid gap-4 w-full max-w-sm">
                    {!isVerifyingPayment && (
                      <button
                        onClick={() => {
                          if (matchCredits > 0) {
                            unlockMutation.mutate();
                          } else {
                            window.location.href = `/payment-plans?requestId=${id}`;
                          }
                        }}
                        className="w-full py-3 px-6 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                      >
                        {matchCredits > 0
                          ? "Unlock with 1 Credit"
                          : "Unlock Report"}
                      </button>
                    )}
                    {isVerifyingPayment && (
                      <div className="w-full py-3 px-6 bg-gray-100 text-gray-500 rounded-lg font-semibold flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </div>
                    )}
                    {matchCredits === 0 && !isVerifyingPayment && (
                      <p className="text-sm text-gray-500">
                        Starting at $49 (or $10 for subscribers)
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Blurred Content Placeholder */}
            <div className="p-8 opacity-20 filter blur-sm select-none pointer-events-none">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-4 mx-auto"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-8 mx-auto"></div>

              <div className="grid gap-6 text-left">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border rounded-xl p-6">
                    <div className="flex justify-between mb-4">
                      <div className="h-6 bg-gray-300 rounded w-1/4"></div>
                      <div className="h-6 bg-gray-300 rounded w-16"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <Link
          href="/requests"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 group"
        >
          <svg
            className="w-5 h-5 group-hover:-translate-x-1 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span className="font-medium">Back to Requests</span>
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-3">
                  {request?.name || request?.category}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    <span>{request?.category}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="capitalize">{request?.status}</span>
                  </div>
                  {/* Only show match results when AI matching is complete (completed), not when unlocked or pending */}
                  {matchReportStatus === "completed" && (
                    <>
                      <div className="flex items-center gap-2 text-gray-600">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                        <span className="font-medium">
                          {request?.matchedCount || 0} suppliers matched
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                        <span className="font-medium">
                          {request?.matchScore || 0}% match score
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-6 space-y-6">
              {/* Name */}
              {request?.name && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Item Name
                  </h3>
                  <p className="text-gray-700">{request.name}</p>
                </div>
              )}

              {/* Unit Price & Total Amount */}
              {(request?.unitPrice || request?.totalAmount) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {request?.unitPrice && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">
                        Unit Price
                      </h3>
                      <p className="text-gray-700">
                        $
                        {typeof request.unitPrice === "number"
                          ? request.unitPrice.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : request.unitPrice}
                      </p>
                    </div>
                  )}
                  {request?.totalAmount && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">
                        Total Amount
                      </h3>
                      <p className="text-gray-700 font-semibold">
                        $
                        {typeof request.totalAmount === "number"
                          ? request.totalAmount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : request.totalAmount}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Quantity */}
              {request?.quantity && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Quantity
                  </h3>
                  <p className="text-gray-700">{request.quantity}</p>
                </div>
              )}

              {/* Description */}
              {request?.description && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Description
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    {request.description}
                  </p>
                </div>
              )}

              {/* Timeline */}
              {request?.timeline && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Timeline
                  </h3>
                  <p className="text-gray-700">{request.timeline}</p>
                </div>
              )}

              {/* Location */}
              {request?.location && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Location
                  </h3>
                  <p className="text-gray-700">{request.location}</p>
                </div>
              )}

              {/* Requirements */}
              {request?.requirements && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Requirements
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    {request.requirements}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <h2 className="text-2xl font-bold text-gray-900">
                Matched Suppliers
              </h2>
              <span className="text-sm text-gray-600 font-medium sm:hidden">
                {suppliers.length}{" "}
                {suppliers.length === 1 ? "supplier" : "suppliers"}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <span className="text-sm text-gray-600 font-medium hidden sm:inline">
                {suppliers.length}{" "}
                {suppliers.length === 1 ? "supplier" : "suppliers"}
              </span>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                {matchReportStatus === "completed" && suppliers.length > 0 && (
                  <button
                    onClick={async () => {
                      if (request) {
                        try {
                          await generateMatchReportPDF(request, suppliers);
                        } catch (error) {
                          console.error("Error generating PDF:", error);
                          toast.error(
                            "Failed to generate PDF. Please try again."
                          );
                        }
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm w-full sm:w-auto"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Download PDF
                  </button>
                )}
                <Link
                  href={`/dashboard/feedback?type=request&requestId=${id}`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm w-full sm:w-auto"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                  Share Feedback
                </Link>
                <Link
                  href={`/managed-services/new?requestId=${id}`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors text-sm w-full sm:w-auto"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Request Managed Services
                </Link>
              </div>
            </div>
          </div>
          {suppliers.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">
                No suppliers matched yet
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {suppliers.map((supplier: Supplier, index: number) => (
                <div
                  key={index}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 border-l-4 border-blue-600 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">
                          {supplier.name}
                        </h3>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                          Rank #{supplier.ranking}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span className="text-sm">{supplier.location}</span>
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-3xl font-bold text-blue-600 mb-1">
                        {supplier.matchScore}%
                      </div>
                      <div className="text-xs text-gray-500 font-medium">
                        Match Score
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4 mb-4">
                    <p className="text-gray-700 leading-relaxed">
                      {supplier.description}
                    </p>
                  </div>

                  {supplier.aiExplanation && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-4 border border-blue-100">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mt-0.5">
                          <svg
                            className="w-4 h-4 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 mb-1">
                            Why they match
                          </p>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {supplier.aiExplanation}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {supplier.strengths && supplier.strengths.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-gray-900 mb-3">
                        Key Strengths
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {supplier.strengths.map(
                          (strength: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium"
                            >
                              {strength}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pt-4 border-t border-gray-200">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                        Email
                      </p>
                      <a
                        href={`mailto:${supplier.email}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 break-all"
                      >
                        {supplier.email}
                      </a>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                        Phone
                      </p>
                      <a
                        href={`tel:${supplier.phone}`}
                        className="text-sm font-medium text-gray-900"
                      >
                        {supplier.phone}
                      </a>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                        Lead Time
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {supplier.leadTime}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                        Min Order
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {supplier.minOrderQuantity}
                      </p>
                    </div>
                  </div>

                  {supplier.website && (
                    <div className="pt-4 border-t border-gray-200">
                      <a
                        href={supplier.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-semibold"
                      >
                        <span>Visit Website</span>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export const dynamic = "force-static";
export const dynamicParams = true;

export default function RequestDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
              <p className="text-gray-600 font-medium">Loading request...</p>
            </div>
          </div>
        </DashboardLayout>
      }
    >
      <RequestDetailsPageContent params={params} />
    </Suspense>
  );
}
