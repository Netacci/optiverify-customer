import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import {
  initiateManagedService,
  getCategories,
  getRequestDetails,
  getCurrentUser,
  getSystemSettings,
  SystemSettings,
} from "@/api";
import toast from "react-hot-toast";
import { AxiosError } from "axios";
import type { Category } from "@/api";
import Head from "next/head";

// Pricing calculation function (matches backend logic)
const calculatePrice = (
  categoryGrade: "low" | "medium" | "high" | undefined,
  urgency: string,
  settings?: {
    gradePrices?: { [key: string]: number };
    urgencyFees?: { [key: string]: { fee: number; duration: string } };
  }
) => {
  // Base price from category grade (use settings or defaults)
  const basePrices = settings?.gradePrices || {
    low: 750,
    medium: 1500,
    high: 2500,
  };
  const basePrice = categoryGrade
    ? basePrices[categoryGrade] || basePrices.medium || 1500
    : 0;

  // Urgency fees (use settings or defaults)
  const urgencyFees = settings?.urgencyFees || {
    standard: { fee: 0, duration: "5-7 days" },
    expedited: { fee: 500, duration: "2-3 days" },
    emergency: { fee: 1000, duration: "24-48 hrs" },
  };
  const urgencyData = urgency
    ? urgencyFees[urgency] || urgencyFees.standard
    : urgencyFees.standard;
  const urgencyFee =
    typeof urgencyData === "object" ? urgencyData.fee : urgencyData;

  const totalPrice = basePrice + urgencyFee;

  return {
    basePrice,
    urgencyFee,
    totalPrice,
  };
};

export default function NewManagedServicePage() {
  const router = useRouter();
  const { requestId } = router.query;
  const requestIdStr = requestId as string | undefined;
  const [step, setStep] = useState(1);
  const [agreed, setAgreed] = useState(false);

  // Fetch request details if requestId is provided
  const { data: requestData } = useQuery({
    queryKey: ["requestDetails", requestIdStr],
    queryFn: () => getRequestDetails(requestIdStr!),
    enabled: !!requestIdStr && router.isReady,
  });

  // Initialize form data
  const [formData, setFormData] = useState({
    itemName: "",
    category: "",
    quantity: "",
    description: "",
    estimatedSpendRange: "",
    urgency: "",
    complianceLevel: "commercial" as "commercial" | "government" | "regulated",
    deliveryLocation: "",
    internalDeadline: "",
  });

  // Track if we've shown the toast to avoid showing it multiple times
  const hasShownToastRef = useRef(false);
  const hasInitializedUrgencyRef = useRef(false);

  // Pre-fill form when request data becomes available
  useEffect(() => {
    if (requestData?.data?.request && requestIdStr && !hasShownToastRef.current) {
      const request = requestData.data.request;
      setFormData((prev) => {
        if (prev.category === "" && prev.description === "") {
          hasShownToastRef.current = true;
          return {
            ...prev,
            itemName: request.name || "",
            category: request.category || "",
            description: request.description || "",
          };
        }
        return prev;
      });
    }
  }, [requestData, requestIdStr]);

  // Show toast when form is pre-filled
  useEffect(() => {
    if (hasShownToastRef.current && formData.category && formData.description) {
      toast.success("Form pre-filled from your match request", {
        duration: 3000,
      });
      hasShownToastRef.current = false;
    }
  }, [formData.category, formData.description]);

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const { data: settingsData } = useQuery({
    queryKey: ["systemSettings"],
    queryFn: getSystemSettings,
    staleTime: 0, // Always fetch fresh settings when component mounts or refetches
    refetchOnMount: true, // Refetch when component mounts
  });

  const categories = categoriesData?.data || [];
  const settings = useMemo<SystemSettings>(
    () => settingsData?.data || ({} as SystemSettings),
    [settingsData?.data]
  );
  const urgencyFees = settings?.urgencyFees || {
    standard: { fee: 0, duration: "5-7 days" },
    expedited: { fee: 500, duration: "2-3 days" },
    emergency: { fee: 1000, duration: "24-48 hrs" },
  };
  const availableUrgencies = Object.keys(urgencyFees);

  // Initialize urgency with first available if not set (only once)
  // Use a ref to track initialization and avoid cascading renders
  useEffect(() => {
    if (
      availableUrgencies.length > 0 &&
      !formData.urgency &&
      !hasInitializedUrgencyRef.current
    ) {
      hasInitializedUrgencyRef.current = true;
      // Use setTimeout to defer state update and avoid synchronous setState in effect
      setTimeout(() => {
        setFormData((prev) => ({ ...prev, urgency: availableUrgencies[0] }));
      }, 0);
    }
  }, [availableUrgencies, formData.urgency]);

  // Get selected category grade
  const selectedCategory = categories.find(
    (cat: Category) => cat.name === formData.category
  );

  // Calculate price in real-time
  const priceCalculation = useMemo(() => {
    return calculatePrice(selectedCategory?.grade, formData.urgency, settings);
  }, [selectedCategory?.grade, formData.urgency, settings]);

  const { data: userData } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => getCurrentUser(),
  });

  const user = userData?.data?.user;

  const initiateMutation = useMutation({
    mutationFn: initiateManagedService,
    onSuccess: (data) => {
      toast.success("Request initiated! Redirecting to payment...");
      router.push(
        `/managed-services/payment/${data.data.requestId}?fee=${
          data.data.serviceFeeAmount
        }&email=${encodeURIComponent(user?.email || "")}`
      );
    },
    onError: (error) => {
      const err = error as AxiosError<{ message?: string }>;
      toast.error(err?.response?.data?.message || "Failed to submit request");
    },
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleNext = () => {
    if (step === 1) {
      if (
        !formData.itemName ||
        !formData.category ||
        !formData.quantity ||
        !formData.description ||
        !formData.estimatedSpendRange ||
        !formData.urgency ||
        !formData.complianceLevel ||
        !formData.deliveryLocation ||
        !formData.internalDeadline
      ) {
        toast.error("Please fill in all required fields");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!agreed) {
        toast.error("You must agree to the terms to proceed");
        return;
      }
      initiateMutation.mutate(formData);
    }
  };

  return (
    <>
      <Head>
        <title>New Managed Service - Optiverifi</title>
      </Head>
      <DashboardLayout>
        <div className="max-w-3xl mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Start a Managed Sourcing Request
          </h1>
          <p className="text-gray-600">
            Let our experts handle your sourcing. We verify, negotiate, and
            deliver results.
          </p>
        </div>

        {requestIdStr && requestData?.data?.request && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900 mb-1">
                  Linked to your match request
                </p>
                <p className="text-sm text-blue-700">
                  This managed service request is based on your &quot;
                  {requestData.data.request.category}&quot; match request. The
                  form has been pre-filled with relevant information.
                </p>
                <Link
                  href={`/requests/${requestIdStr}`}
                  className="text-sm text-blue-600 hover:text-blue-700 underline mt-2 inline-block"
                >
                  View original request →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Progress Steps */}
        <div className="flex items-center mb-8">
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step >= 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
            } font-bold`}
          >
            1
          </div>
          <div
            className={`flex-1 h-1 mx-4 ${
              step >= 2 ? "bg-blue-600" : "bg-gray-200"
            }`}
          ></div>
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step >= 2 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
            } font-bold`}
          >
            2
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Project Details
              </h2>

              {/* Item Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="itemName"
                  value={formData.itemName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400"
                  placeholder="e.g., Custom Printed T-Shirts"
                  required
                />
              </div>

              {/* Category and Quantity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map((cat: Category) => (
                      <option key={cat._id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400"
                    placeholder="e.g., 5000 units"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400 resize-none"
                  placeholder="Describe exactly what you need (materials, dimensions, standards, etc.)"
                  required
                />
              </div>

              {/* Estimated Spend Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Spend Range <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="estimatedSpendRange"
                  value={formData.estimatedSpendRange}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400"
                  placeholder="e.g., $10,000 - $15,000"
                  required
                />
              </div>

              {/* Urgency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Urgency <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {availableUrgencies.map((urgency) => {
                    const urgencyData = urgencyFees[urgency];
                    const fee =
                      typeof urgencyData === "object"
                        ? urgencyData.fee
                        : urgencyData;
                    const duration =
                      typeof urgencyData === "object"
                        ? urgencyData.duration
                        : "";
                    return (
                      <label
                        key={urgency}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="urgency"
                          value={urgency}
                          checked={formData.urgency === urgency}
                          onChange={handleChange}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-900">
                          {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
                          {duration && (
                            <span className="text-gray-500 ml-2">
                              ({duration})
                            </span>
                          )}
                          {fee > 0 && (
                            <span className="text-gray-500 ml-2">
                              +${fee.toLocaleString()}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Compliance Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Compliance Level <span className="text-red-500">*</span>
                </label>
                <select
                  name="complianceLevel"
                  value={formData.complianceLevel}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  required
                >
                  <option value="commercial">Commercial</option>
                  <option value="government">Government</option>
                  <option value="regulated">Regulated</option>
                </select>
              </div>

              {/* Delivery Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="deliveryLocation"
                  value={formData.deliveryLocation}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400"
                  placeholder="City, Country"
                  required
                />
              </div>

              {/* Internal Deadline */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Internal Deadline <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="internalDeadline"
                  value={formData.internalDeadline}
                  onChange={handleChange}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  required
                />
              </div>

              {/* Price Calculator */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Service Fee Calculation
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-700">
                      Base Price (Category: {selectedCategory?.grade || "N/A"}):
                    </span>
                    <span className="font-semibold text-gray-900">
                      ${priceCalculation.basePrice.toLocaleString()}
                    </span>
                  </div>
                  {priceCalculation.urgencyFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-700">
                        Urgency Fee ({formData.urgency}):
                      </span>
                      <span className="font-semibold text-gray-900">
                        ${priceCalculation.urgencyFee.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 mt-2 border-t-2 border-blue-300 flex justify-between">
                    <span className="text-lg font-bold text-gray-900">
                      Total Service Fee:
                    </span>
                    <span className="text-lg font-bold text-blue-600">
                      ${priceCalculation.totalPrice.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Terms & Service Fee
              </h2>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-medium text-blue-900">
                    Upfront Service Fee
                  </span>
                  <span className="text-2xl font-bold text-blue-700">
                    ${priceCalculation.totalPrice.toLocaleString()}
                  </span>
                </div>
                <p className="text-blue-800 text-sm">
                  This fee covers our initial research, supplier verification,
                  and RFQ preparation.
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-medium text-yellow-900">
                    Savings Fee
                  </span>
                  <span className="text-2xl font-bold text-yellow-700">8%</span>
                </div>
                <p className="text-yellow-800 text-sm">
                  We only charge this fee <strong>if we secure savings</strong>{" "}
                  below your target budget or original supplier quotes. It is
                  calculated as 8% of the total amount saved.
                </p>
              </div>

              <div className="pt-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-1 w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-gray-700 text-sm">
                    I agree to pay the{" "}
                    <strong>
                      ${priceCalculation.totalPrice.toLocaleString()} service
                      fee
                    </strong>{" "}
                    now to start the project. I understand that an additional{" "}
                    <strong>8% fee</strong> will apply only if savings are
                    achieved on the final negotiated price.
                  </span>
                </label>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            ) : (
              <div></div>
            )}

            <button
              onClick={handleNext}
              disabled={initiateMutation.isPending || (step === 2 && !agreed)}
              className="px-8 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {initiateMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Processing...
                </>
              ) : step === 2 ? (
                `Pay $${priceCalculation.totalPrice.toLocaleString()} & Submit`
              ) : (
                "Next Step"
              )}
            </button>
          </div>
        </div>
      </div>
      </DashboardLayout>
    </>
  );
}
