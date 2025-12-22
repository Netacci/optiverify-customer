import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  createCheckoutSession,
  getCurrentUser,
  getSystemSettings,
  getSubscriptionStatus,
  CheckoutRequest,
} from "@/api";
import { getPlans } from "@/api/plans";
import DashboardLayout from "@/components/DashboardLayout";
import { useRouter } from "next/router";
import { AxiosError } from "axios";
import Head from "next/head";

export default function PaymentPlansPage() {
  const router = useRouter();
  const requestId = router.query.requestId as string | undefined;
  const isTopUp = router.query.topUp === "true";
  const initialQuantity = parseInt((router.query.quantity as string) || "1");
  const [selectedPlan, setSelectedPlan] = useState<
    CheckoutRequest["planType"] | "starter" | "professional"
  >("one-time");
  // If there's a requestId, force quantity to 1 (only for that specific request)
  // Otherwise, allow multiple credits for general top-up
  const isTopUpForRequest = isTopUp && requestId !== undefined && requestId !== null;
  const [creditQuantity, setCreditQuantity] = useState(1);

  // Initialize state based on router query when ready
  useEffect(() => {
    if (!router.isReady) return;
    
    if (isTopUp) {
      setSelectedPlan("extra_credit");
    }
    setCreditQuantity(isTopUpForRequest ? 1 : initialQuantity);
  }, [router.isReady, isTopUp, isTopUpForRequest, initialQuantity]);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [starterIsAnnual, setStarterIsAnnual] = useState(false);
  const [professionalIsAnnual, setProfessionalIsAnnual] = useState(false);

  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => getCurrentUser(),
  });

  const { data: subscriptionData } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscriptionStatus,
  });

  const { data: settingsData } = useQuery({
    queryKey: ["systemSettings"],
    queryFn: getSystemSettings,
  });

  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
  });

  const user = userData?.data?.user;
  const isActiveSubscriber =
    subscriptionData?.data?.subscriptionStatus === "active";
  const settings = settingsData?.data || {
    extraCreditPrice: 10,
    savingsFeePercentage: 8,
  };

  // Transform database plans to component format
  const BASE_PLANS = useMemo(() => {
    const dbPlans = plansData?.data || [];
    type PlanItem = {
      id: string;
      name: string;
      price: string;
      period: string;
      description: string;
      features: string[];
      popular: boolean;
      hasToggle: boolean;
      toggleState?: boolean;
      setToggleState?: (value: boolean) => void;
    };
    const result: PlanItem[] = [];

    for (const plan of dbPlans) {
      if (plan.planType === "basic") {
        result.push({
          id: "one-time",
          name: plan.name,
          price: `$${plan.price}`,
          period: "per Match",
          description:
            plan.description ||
            "Best for small teams or one-time sourcing needs",
          features: plan.features.map((f: string) =>
            f.includes("extra matches")
              ? f.replace(/\$(\d+)/, `$${settings.extraCreditPrice}`)
              : f
          ),
          popular: plan.isPopular,
          hasToggle: false,
        });
      } else if (plan.planType === "starter") {
        result.push({
          id: "starter",
          name: plan.name,
          price:
            starterIsAnnual && plan.hasAnnualPricing && plan.annualPrice
              ? `$${plan.annualPrice}`
              : `$${plan.price}`,
          period: starterIsAnnual && plan.hasAnnualPricing ? "/year" : "/month",
          description:
            starterIsAnnual && plan.hasAnnualPricing
              ? "Save with annual billing"
              : plan.description || "For owners & lean teams",
          features: plan.features.map((f: string) =>
            f.includes("extra matches")
              ? f.replace(/\$(\d+)/, `$${settings.extraCreditPrice}`)
              : f
          ),
          popular: plan.isPopular,
          hasToggle: plan.hasAnnualPricing,
          toggleState: starterIsAnnual,
          setToggleState: setStarterIsAnnual,
        });
      } else if (plan.planType === "professional") {
        result.push({
          id: "professional",
          name: plan.name,
          price:
            professionalIsAnnual && plan.hasAnnualPricing && plan.annualPrice
              ? `$${plan.annualPrice}`
              : `$${plan.price}`,
          period:
            professionalIsAnnual && plan.hasAnnualPricing ? "/year" : "/month",
          description:
            professionalIsAnnual && plan.hasAnnualPricing
              ? "Best value for professional teams"
              : plan.description || "For procurement-led organizations",
          features: plan.features.map((f: string) =>
            f.includes("extra matches")
              ? f.replace(/\$(\d+)/, `$${settings.extraCreditPrice}`)
              : f
          ),
          popular: plan.isPopular,
          hasToggle: plan.hasAnnualPricing,
          toggleState: professionalIsAnnual,
          setToggleState: setProfessionalIsAnnual,
        });
      }
    }

    return result;
  }, [
    plansData?.data,
    starterIsAnnual,
    professionalIsAnnual,
    settings.extraCreditPrice,
  ]);

  // If user is active subscriber, ONLY show the top-up plan
  // Otherwise, show all base plans
  const pricingPlans = isActiveSubscriber
    ? [
        {
          id: "extra_credit",
          name: "Top Up Credit",
          price: `$${settings.extraCreditPrice}`,
          period: "per Credit",
          description: "Add credits to your balance",
          features: [
            `1 credit per $${settings.extraCreditPrice}`,
            "Instant unlock",
            "Rollover to next month",
            "Priority processing",
          ],
          popular: false,
          hasToggle: false,
        },
      ]
    : BASE_PLANS;

  const checkoutMutation = useMutation({
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

  const handleCheckout = () => {
    if (!user?.email) {
      toast.error("User email not found");
      return;
    }

    if (isProcessingCheckout || checkoutMutation.isPending) {
      return; // Prevent multiple clicks
    }

    // For top-up without a requestId, we need to handle differently
    // For now, if it's a top-up and no requestId, we'll need to create a dummy request or handle it specially

    if (!requestId && !isTopUp) {
      toast.error("Please submit a request first to unlock payment options");
      router.push("/submit-request");
      return;
    }

    // For top-up, if no requestId, we'll use "general" as a placeholder
    // The backend will need to handle this case
    const effectiveRequestId = requestId || "general";

    // Get the actual planType to send to Stripe based on selected plan and toggle state
    let planType: CheckoutRequest["planType"];
    if (selectedPlan === "starter") {
      planType = starterIsAnnual ? "starter_annual" : "starter_monthly";
    } else if (selectedPlan === "professional") {
      planType = professionalIsAnnual
        ? "professional_annual"
        : "professional_monthly";
    } else {
      planType = selectedPlan;
    }

    // Disable button immediately
    setIsProcessingCheckout(true);

    checkoutMutation.mutate({
      requestId: effectiveRequestId,
      planType: planType,
      email: user.email,
      ...(selectedPlan === "extra_credit" ? { quantity: creditQuantity } : {}),
    });
  };

  // Show loader while checking user subscription status to prevent flash
  if (isLoadingUser || !router.isReady) {
    return (
      <>
        <Head>
          <title>Payment Plans - Optiverifi</title>
        </Head>
        <DashboardLayout>
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
              <p className="text-gray-600 font-medium">
                Loading payment options...
              </p>
            </div>
          </div>
        </DashboardLayout>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Payment Plans - Optiverifi</title>
      </Head>
      <DashboardLayout>
        <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isActiveSubscriber ? "Top Up Credits" : "Payment Plans"}
          </h1>
          <p className="text-gray-600">
            {isActiveSubscriber
              ? "Add credits to unlock match reports ($10 per credit)"
              : "Choose the plan that works best for your sourcing needs"}
          </p>
        </div>

        {/* Quantity Selector for Top-Up (only show for general top-up, not for specific request) */}
        {isActiveSubscriber && isTopUp && (!requestId || requestId === undefined) && (
          <div className="max-w-md mx-auto mb-6 bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-4">
              Number of Credits
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={() =>
                  setCreditQuantity(Math.max(1, creditQuantity - 1))
                }
                className="w-12 h-12 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
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
                value={creditQuantity}
                onChange={(e) =>
                  setCreditQuantity(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-center text-xl font-semibold"
              />
              <button
                onClick={() =>
                  setCreditQuantity(Math.min(100, creditQuantity + 1))
                }
                className="w-12 h-12 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
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
            <div className="mt-4 bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Credits:</span>
                <span className="text-lg font-semibold text-gray-900">
                  {creditQuantity}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Price per credit:</span>
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
                      creditQuantity * (settings.extraCreditPrice || 10)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pricing Cards */}
        <div
          className={`grid gap-6 sm:gap-8 max-w-6xl mx-auto mb-10 sm:mb-12 lg:mb-16 ${
            isActiveSubscriber
              ? "grid-cols-1 max-w-md mx-auto"
              : "grid-cols-1 md:grid-cols-3"
          }`}
        >
          {pricingPlans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 sm:p-8 transition-all duration-300 ${
                  isSelected
                    ? plan.popular
                      ? "bg-blue-600 text-white shadow-2xl md:scale-105 border-4 border-blue-400 ring-1 ring-blue-200 ring-offset-2"
                      : "bg-white border-4 border-blue-600 shadow-2xl ring-1 ring-blue-200 ring-offset-2"
                    : plan.popular
                    ? "bg-blue-600 text-white shadow-xl md:scale-105 border-2 border-blue-600 hover:border-blue-400"
                    : "bg-white border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg"
                } cursor-pointer`}
                onClick={() =>
                  setSelectedPlan(plan.id as CheckoutRequest["planType"])
                }
              >
                {/* Selected Badge */}
                {isSelected && (
                  <div className="absolute -top-3 -right-3 z-10">
                    <div className="flex items-center justify-center w-10 h-10 bg-green-500 rounded-full shadow-lg border-2 border-white">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Popular Badge */}
                {plan.popular && !isSelected && (
                  <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-block px-3 sm:px-4 py-1 bg-white text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-5 sm:mb-6">
                  <h3
                    className={`text-lg sm:text-xl font-bold mb-2 sm:mb-3 ${
                      plan.popular ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {plan.name}
                  </h3>

                  {/* Toggle for plans with hasToggle */}
                  {plan.hasToggle && (
                    <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-5">
                      <span
                        className={`text-sm font-medium ${
                          !plan.toggleState
                            ? plan.popular
                              ? "text-white"
                              : "text-gray-900"
                            : plan.popular
                            ? "text-blue-200"
                            : "text-gray-500"
                        }`}
                      >
                        Monthly
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (plan.setToggleState) {
                            plan.setToggleState(!plan.toggleState);
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          plan.popular
                            ? "bg-white focus:ring-blue-500"
                            : "bg-blue-600 focus:ring-blue-500"
                        }`}
                        aria-label="Toggle billing period"
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                            plan.toggleState ? "translate-x-6" : "translate-x-1"
                          } ${plan.popular ? "bg-blue-600" : "bg-white"}`}
                        />
                      </button>
                      <span
                        className={`text-sm font-medium ${
                          plan.toggleState
                            ? plan.popular
                              ? "text-white"
                              : "text-gray-900"
                            : plan.popular
                            ? "text-blue-200"
                            : "text-gray-500"
                        }`}
                      >
                        Annual
                      </span>
                    </div>
                  )}

                  <div className="mb-2 sm:mb-3">
                    <span
                      className={`text-4xl sm:text-5xl font-bold ${
                        plan.popular ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span
                        className={`text-base sm:text-lg ${
                          plan.popular ? "text-blue-100" : "text-gray-500"
                        }`}
                      >
                        {plan.period}
                      </span>
                    )}
                  </div>

                  <p
                    className={`text-xs sm:text-sm ${
                      plan.popular ? "text-blue-100" : "text-gray-500"
                    }`}
                  >
                    {plan.description}
                  </p>
                </div>

                {/* Features List */}
                <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <svg
                        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                          plan.popular ? "text-white" : "text-blue-600"
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span
                        className={`text-xs sm:text-sm ${
                          plan.popular ? "text-blue-50" : "text-gray-600"
                        }`}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Selection Indicator */}
                <div
                  className={`flex items-center justify-center gap-2 w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-sm sm:text-base text-center transition-all ${
                    isSelected
                      ? plan.popular
                        ? "bg-white text-blue-600 hover:bg-blue-50 shadow-lg"
                        : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg"
                      : plan.popular
                      ? "bg-white text-blue-600 hover:bg-blue-50 shadow-lg"
                      : "bg-gray-900 text-white hover:bg-gray-800 hover:shadow-lg"
                  }`}
                >
                  {isSelected ? (
                    <>
                      <svg
                        className={`w-5 h-5 ${
                          plan.popular ? "text-blue-600" : "text-white"
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span>Selected</span>
                    </>
                  ) : (
                    <span>Select</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex flex-col items-center justify-center border-t border-gray-200 pt-8">
          <div className="text-center max-w-lg mx-auto mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Ready to proceed?
            </h3>
            <p className="text-gray-500">
              You&apos;ve selected the{" "}
              <span className="font-semibold text-gray-900">
                {pricingPlans.find((p) => p.id === selectedPlan)?.name}
              </span>
              . Click below to complete your secure payment.
            </p>
          </div>

          <button
            onClick={handleCheckout}
            disabled={
              isProcessingCheckout ||
              checkoutMutation.isPending ||
              !selectedPlan
            }
            className="w-full max-w-md px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform hover:-translate-y-0.5"
          >
            {isProcessingCheckout || checkoutMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                Processing Payment...
              </>
            ) : (
              <>
                <span>Proceed to Checkout</span>
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
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </>
            )}
          </button>

          <p className="mt-4 text-xs text-gray-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            Secure payment via Stripe. Encrypted & Safe.
          </p>
        </div>
      </div>
    </DashboardLayout>
    </>
  );
}
