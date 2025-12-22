"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  getSubscriptionStatus,
  updateSubscription,
  getCurrentUser,
  createCheckoutSession,
  syncUserPayments,
  getSystemSettings,
  getCreditTransactions,
  CreditTransaction,
} from "@/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { AxiosError } from "axios";

function BillingPageContent() {
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpQuantity, setTopUpQuantity] = useState(1);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [creditTransactionsPage, setCreditTransactionsPage] = useState(1);
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasSyncedRef = useRef(false);

  const { data: subscriptionData, refetch } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => getSubscriptionStatus(),
  });

  const { data: userData } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => getCurrentUser(),
  });

  const { data: settingsData } = useQuery({
    queryKey: ["systemSettings", "public"],
    queryFn: getSystemSettings,
  });

  const {
    data: creditTransactionsData,
    isLoading: isLoadingTransactions,
    refetch: refetchCreditTransactions,
  } = useQuery({
    queryKey: ["creditTransactions", creditTransactionsPage],
    queryFn: () =>
      getCreditTransactions({ page: creditTransactionsPage, limit: 5 }),
  });

  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: () => import("@/api/plans").then((m) => m.getPlans()),
  });

  const subscriptionStatus = subscriptionData?.data;
  const user = userData?.data?.user;
  const settings = settingsData?.data || {
    extraCreditPrice: 10,
  };

  // Build subscription plans from Plans API
  const SUBSCRIPTION_PLANS = useMemo(() => {
    const dbPlans = plansData?.data || [];
    const result: Array<{
      id: string;
      name: string;
      price: string;
      period: string;
      description: string;
    }> = [];

    for (const plan of dbPlans) {
      if (plan.planType === "starter") {
        result.push({
          id: "starter_monthly",
          name: `${plan.name} Monthly`,
          price: `$${plan.price}`,
          period: "/month",
          description: `${plan.credits} matches per month`,
        });
        if (plan.hasAnnualPricing && plan.annualPrice) {
          result.push({
            id: "starter_annual",
            name: `${plan.name} Annual`,
            price: `$${plan.annualPrice}`,
            period: "/year",
            description: `${plan.credits} matches per month`,
          });
        }
      } else if (plan.planType === "professional") {
        result.push({
          id: "professional_monthly",
          name: `${plan.name} Monthly`,
          price: `$${plan.price}`,
          period: "/month",
          description: `${plan.credits} matches per month${
            plan.maxRolloverCredits
              ? ` (max ${plan.maxRolloverCredits} credits rollover)`
              : ""
          }`,
        });
        if (plan.hasAnnualPricing && plan.annualPrice) {
          result.push({
            id: "professional_annual",
            name: `${plan.name} Annual`,
            price: `$${plan.annualPrice}`,
            period: "/year",
            description: `${plan.credits} matches per month${
              plan.maxRolloverCredits
                ? ` (max ${plan.maxRolloverCredits} credits rollover)`
                : ""
            }`,
          });
        }
      }
    }

    return result;
  }, [plansData?.data]);
  const isActiveSubscriber =
    subscriptionStatus?.subscriptionStatus === "active";
  const hasZeroCredits = (subscriptionStatus?.matchCredits || 0) === 0;

  const updateSubscriptionMutation = useMutation({
    mutationFn: updateSubscription,
    onSuccess: () => {
      toast.success("Subscription updated successfully!");
      refetch();
    },
    onError: (error: unknown) => {
      const err = error as AxiosError<{ message: string }>;
      const errorMessage =
        err?.response?.data?.message || "Failed to update subscription";
      toast.error(errorMessage);
    },
  });

  const topUpMutation = useMutation({
    mutationFn: createCheckoutSession,
    onSuccess: (data) => {
      if (data.data?.url) {
        // Keep button disabled during redirect
        setIsProcessingCheckout(true);
        window.location.href = data.data.url;
      } else {
        setIsProcessingCheckout(false);
        toast.error("No checkout URL received");
      }
    },
    onError: (error: unknown) => {
      setIsProcessingCheckout(false);
      const err = error as AxiosError<{ message: string }>;
      const errorMessage =
        err?.response?.data?.message || "Failed to create checkout session";
      toast.error(errorMessage);
    },
  });

  const syncPaymentsMutation = useMutation({
    mutationFn: syncUserPayments,
    onSuccess: () => {
      // Silently sync - no toast for automatic syncs
      refetch(); // Refresh subscription data to show updated credits
      refetchCreditTransactions(); // Refresh credit transaction history
    },
    onError: (error: unknown) => {
      // Silently fail for automatic syncs - webhook will eventually process it
      console.error("Auto-sync failed:", error);
    },
  });

  // Auto-sync payments when returning from successful top-up payment
  useEffect(() => {
    const topUpSuccess = searchParams.get("topUp") === "success";
    if (topUpSuccess && !hasSyncedRef.current) {
      // Mark as synced to prevent multiple calls
      hasSyncedRef.current = true;

      // Remove query param from URL first
      router.replace("/billing", { scroll: false });

      // Auto-sync payments (use a small delay to ensure URL is updated)
      setTimeout(() => {
        syncPaymentsMutation.mutate();
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleTopUp = () => {
    if (!user?.email) {
      toast.error("User email not found");
      return;
    }

    if (topUpQuantity < 1) {
      toast.error("Please select at least 1 credit");
      return;
    }

    if (isProcessingCheckout || topUpMutation.isPending) {
      return; // Prevent multiple clicks
    }

    // Disable button immediately
    setIsProcessingCheckout(true);

    // Directly create checkout session for top-up with quantity
    topUpMutation.mutate({
      requestId: "general", // Use "general" for top-up without a specific request
      planType: "extra_credit",
      email: user.email,
      quantity: topUpQuantity,
    });
  };

  const handleSwitchPlan = (planType: string) => {
    if (planType === subscriptionStatus?.planType) {
      toast("This is already your active plan", { icon: "ℹ️" });
      return;
    }

    updateSubscriptionMutation.mutate({
      planType: planType as "one-time" | "monthly" | "annual" | "enterprise",
    });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700";
      case "expired":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "expired":
        return "Expired";
      default:
        return "No Subscription";
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Billing & Subscription
          </h1>
          <p className="text-gray-600">
            Manage your subscription, credits, and billing information
          </p>
        </div>

        {/* Credits Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Match Credits
              </h2>
              <p className="text-sm text-gray-600">
                Available credits to unlock match reports
              </p>
            </div>
            <div className="text-right">
              <span className="text-4xl font-bold text-blue-600">
                {subscriptionStatus?.matchCredits || 0}
              </span>
              <p className="text-xs text-gray-500 mt-1">Credits Available</p>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> You use 1 credit per match unlock.
            </p>
          </div>

          {/* Top Up Button for Active Subscribers with 0 Credits */}
          {isActiveSubscriber && hasZeroCredits && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShowTopUpModal(true)}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Top Up Credits
              </button>
            </div>
          )}
        </div>

        {/* Top Up Modal */}
        {showTopUpModal && (
          <div className="fixed inset-0 bg-black/50 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-10 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative z-10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  Top Up Credits
                </h3>
                <button
                  onClick={() => setShowTopUpModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Number of Credits
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() =>
                      setTopUpQuantity(Math.max(1, topUpQuantity - 1))
                    }
                    className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 12H4"
                      />
                    </svg>
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={topUpQuantity}
                    onChange={(e) =>
                      setTopUpQuantity(
                        Math.max(1, parseInt(e.target.value) || 1)
                      )
                    }
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center text-lg font-semibold"
                  />
                  <button
                    onClick={() =>
                      setTopUpQuantity(Math.min(100, topUpQuantity + 1))
                    }
                    className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Credits:</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {topUpQuantity}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">
                    Price per credit:
                  </span>
                  <span className="text-lg font-semibold text-gray-900">
                    ${settings.extraCreditPrice || 10}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold text-gray-900">
                      Total:
                    </span>
                    <span className="text-2xl font-bold text-blue-600">
                      $
                      {(
                        topUpQuantity * (settings.extraCreditPrice || 10)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowTopUpModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTopUp}
                  disabled={isProcessingCheckout || topUpMutation.isPending}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessingCheckout || topUpMutation.isPending
                    ? "Processing..."
                    : "Proceed to Checkout"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Credit Transactions History */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Credit Transaction History
            </h2>
            <p className="text-sm text-gray-600">
              View all credit transactions and usage history
            </p>
          </div>

          {isLoadingTransactions ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600"></div>
            </div>
          ) : creditTransactionsData?.data?.transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No credit transactions yet.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Credits
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {creditTransactionsData?.data?.transactions.map(
                      (transaction: CreditTransaction) => {
                        const isDeducted =
                          transaction.transactionType === "deducted";
                        const reasonLabels: Record<string, string> = {
                          match_generation: "AI Match Generation",
                          unlock_request: "Unlock Request",
                          subscription_allocation: "Subscription Allocation",
                          top_up: "Top Up",
                          rollover: "Rollover",
                        };

                        return (
                          <tr key={transaction.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(
                                transaction.createdAt
                              ).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  isDeducted
                                    ? "bg-red-100 text-red-800"
                                    : "bg-green-100 text-green-800"
                                }`}
                              >
                                {isDeducted ? "Deducted" : "Added"}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-900">
                              <div>
                                <p className="font-medium">
                                  {reasonLabels[transaction.reason] ||
                                    transaction.reason}
                                </p>
                                {transaction.requestName && (
                                  <p className="text-gray-500 text-xs mt-1">
                                    {transaction.requestName}
                                    {transaction.requestCategory &&
                                      ` - ${transaction.requestCategory}`}
                                  </p>
                                )}
                                {transaction.notes && (
                                  <p className="text-gray-500 text-xs mt-1">
                                    {transaction.notes}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td
                              className={`px-4 py-4 whitespace-nowrap text-sm font-semibold ${
                                isDeducted ? "text-red-600" : "text-green-600"
                              }`}
                            >
                              {isDeducted ? "-" : "+"}
                              {transaction.creditsUsed}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div>
                                <p className="font-medium">
                                  {transaction.creditsAfter}
                                </p>
                                {/* <p className="text-xs text-gray-500">
                                  (was {transaction.creditsBefore})
                                </p> */}
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {creditTransactionsData?.data?.pagination &&
                creditTransactionsData.data.pagination.total > 5 && (
                  <div className="mt-6 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing page {creditTransactionsData.data.pagination.page}{" "}
                      of {creditTransactionsData.data.pagination.totalPages} (
                      {creditTransactionsData.data.pagination.total} total
                      transactions)
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setCreditTransactionsPage((p) => Math.max(1, p - 1))
                        }
                        disabled={creditTransactionsPage === 1}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCreditTransactionsPage((p) => p + 1)}
                        disabled={
                          creditTransactionsPage >=
                          creditTransactionsData.data.pagination.totalPages
                        }
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
            </>
          )}
        </div>

        {/* Current Subscription Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Current Subscription
            </h2>
            <p className="text-sm text-gray-600">
              Your active subscription details
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Status</p>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(
                  subscriptionStatus?.subscriptionStatus
                )}`}
              >
                {getStatusLabel(subscriptionStatus?.subscriptionStatus)}
              </span>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">
                Plan Type
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {subscriptionStatus?.planType
                  ? subscriptionStatus.planType.charAt(0).toUpperCase() +
                    subscriptionStatus.planType.slice(1)
                  : "None"}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">
                Expiration Date
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {subscriptionStatus?.subscriptionExpiresAt
                  ? formatDate(subscriptionStatus.subscriptionExpiresAt)
                  : "N/A"}
              </p>
            </div>
          </div>

          {subscriptionStatus?.subscriptionStatus === "expired" && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-yellow-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <p className="text-sm font-medium text-yellow-800">
                    Your subscription has expired. Renew to continue using the
                    service.
                  </p>
                </div>
                <Link
                  href="/dashboard/payment-plans"
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-semibold hover:bg-yellow-700 transition-colors"
                >
                  Renew Now
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Switch Plan Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Switch Subscription Plan
            </h2>
            <p className="text-sm text-gray-600">
              Change your subscription plan at any time
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SUBSCRIPTION_PLANS.map(
              (plan: {
                id: string;
                name: string;
                price: string;
                period: string;
                description: string;
              }) => {
                const isActive = subscriptionStatus?.planType === plan.id;

                return (
                  <div
                    key={plan.id}
                    className={`rounded-xl border-2 p-6 transition-all ${
                      isActive
                        ? "border-blue-500 shadow-lg bg-blue-50"
                        : "border-gray-200 hover:border-blue-300 hover:shadow-md"
                    }`}
                  >
                    <div className="text-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {plan.name}
                      </h3>
                      <div className="mb-2">
                        <span className="text-3xl font-extrabold text-gray-900">
                          {plan.price}
                        </span>
                        {plan.period && (
                          <span className="text-lg text-gray-600 ml-1">
                            {plan.period}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {plan.description}
                      </p>
                    </div>

                    {isActive ? (
                      <div className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold text-center">
                        Current Plan
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSwitchPlan(plan.id)}
                        disabled={updateSubscriptionMutation.isPending}
                        className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updateSubscriptionMutation.isPending
                          ? "Switching..."
                          : "Switch to This Plan"}
                      </button>
                    )}
                  </div>
                );
              }
            )}
          </div>

          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
            <p className="text-sm text-gray-600">
              Looking for a single match unlock? Visit{" "}
              <Link
                href="/payment-plans"
                className="text-blue-600 hover:underline"
              >
                Payment Plans
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
              <p className="text-gray-600 font-medium">
                Loading billing page...
              </p>
            </div>
          </div>
        </DashboardLayout>
      }
    >
      <BillingPageContent />
    </Suspense>
  );
}
