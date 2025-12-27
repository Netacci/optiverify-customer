import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getManagedServiceDetails,
  syncManagedServicePayment,
  createServiceFeePaymentSession,
  createSavingsFeePaymentSession,
  updateManagedService,
  deleteManagedService,
  getCategories,
  Category,
} from "@/api";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { AxiosError } from "axios";
import Head from "next/head";

const STAGES = [
  { id: "review", label: "Project Review" },
  { id: "rfq_prep", label: "RFQ Preparation" },
  { id: "supplier_outreach", label: "Supplier Outreach" },
  { id: "collecting_quotes", label: "Collecting Quotes" },
  { id: "negotiating", label: "Negotiating Terms" },
  { id: "report_ready", label: "Final Report" },
];

export default function ManagedServiceDetailsPage() {
  const router = useRouter();
  const { id, payment } = router.query;
  const serviceId = id as string;
  const paymentStatus = payment as string;
  const queryClient = useQueryClient();

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    category: "",
    specifications: "",
    quantity: "",
    deliveryLocation: "",
    budget: "",
    deadline: "",
  });

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Poll every 30 seconds for updates
  const {
    data: requestData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["managedService", serviceId],
    queryFn: () => getManagedServiceDetails(serviceId),
    enabled: !!serviceId && router.isReady,
    refetchInterval: 30000,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
    enabled: isEditing,
  });

  const categories = categoriesData?.data || [];

  const syncPaymentMutation = useMutation({
    mutationFn: () => syncManagedServicePayment(serviceId),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || "Payment status synced successfully");
        refetch();
      } else {
        toast.error(data.message || "Failed to sync payment status");
      }
    },
    onError: (error: unknown) => {
      const errorMessage =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || "Failed to sync payment status";
      toast.error(errorMessage);
    },
  });

  const serviceFeePaymentMutation = useMutation({
    mutationFn: (data: { amount: number; email: string }) =>
      createServiceFeePaymentSession(serviceId, data.amount, data.email),
    onSuccess: (data) => {
      if (data.success && data.data?.url) {
        toast.success("Redirecting to payment...");
        window.location.href = data.data.url;
      } else {
        toast.error("Failed to create payment session");
      }
    },
    onError: (error: unknown) => {
      const errorMessage =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || "Failed to create payment session";
      toast.error(errorMessage);
    },
  });

  const savingsFeePaymentMutation = useMutation({
    mutationFn: () => createSavingsFeePaymentSession(serviceId),
    onSuccess: (data) => {
      if (data.success && data.data?.url) {
        toast.success("Redirecting to payment...");
        window.location.href = data.data.url;
      } else {
        toast.error("Failed to create payment session");
      }
    },
    onError: (error: unknown) => {
      const errorMessage =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || "Failed to create payment session";
      toast.error(errorMessage);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof editFormData) =>
      updateManagedService(serviceId, data),
    onSuccess: () => {
      toast.success("Request updated successfully");
      setIsEditing(false);
      queryClient.invalidateQueries({
        queryKey: ["managedService", serviceId],
      });
    },
    onError: (error: unknown) => {
      const err = error as AxiosError<{ message: string }>;
      toast.error(err?.response?.data?.message || "Failed to update request");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteManagedService(serviceId),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || "Request deleted successfully");
        queryClient.invalidateQueries({
          queryKey: ["managedServices"],
        });
        router.push("/managed-services");
      } else {
        toast.error(data.message || "Failed to delete request");
      }
    },
    onError: (error: unknown) => {
      const err = error as AxiosError<{ message: string }>;
      toast.error(err?.response?.data?.message || "Failed to delete request");
    },
  });

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        setShowDeleteConfirm(false);
      },
    });
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  // Refetch immediately if returning from successful payment
  useEffect(() => {
    if (paymentStatus === "success" && router.isReady) {
      // Wait a moment for webhook to process, then sync and refetch
      setTimeout(() => {
        syncPaymentMutation.mutate();
        refetch();
        toast.success("Payment successful! Processing request...");
        // Remove query param from URL
        router.replace(`/managed-services/${serviceId}`, undefined, {
          shallow: true,
        });
      }, 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentStatus, router.isReady]);

  const request = requestData?.data;

  // Initialize edit form when opening edit mode
  useEffect(() => {
    if (isEditing && request) {
      setEditFormData({
        category: request.category || "",
        specifications: request.specifications || "",
        quantity: request.quantity || "",
        deliveryLocation: request.deliveryLocation || "",
        budget: request.budget || "",
        deadline: request.deadline || "",
      });
    }
  }, [isEditing, request]);

  const getCurrentStepIndex = () => {
    if (!request) return 0;
    if (request.stage === "final_report" || request.stage === "completed")
      return STAGES.length;
    if (request.stage === "payment_pending") return -1;
    return STAGES.findIndex((s) => s.id === request.stage);
  };

  const currentStep = getCurrentStepIndex();

  if (isLoading || !router.isReady) {
    return (
      <>
        <Head>
          <title>Managed Service - Optiverifi</title>
        </Head>
        <DashboardLayout>
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
          </div>
        </DashboardLayout>
      </>
    );
  }

  if (!request) {
    return (
      <>
        <Head>
          <title>Service Not Found - Optiverifi</title>
        </Head>
        <DashboardLayout>
          <div className="text-center py-16">
            <h2 className="text-xl font-semibold text-gray-900">
              Request not found
            </h2>
            <Link
              href="/managed-services"
              className="text-blue-600 hover:underline mt-4 inline-block"
            >
              Back to Managed Services
            </Link>
          </div>
        </DashboardLayout>
      </>
    );
  }

  // Can edit if stage is 'payment_pending' or 'review' (first stage after payment)
  const canEdit =
    request.stage === "payment_pending" || request.stage === "review";

  return (
    <>
      <Head>
        <title>Managed Service Details - Optiverifi</title>
      </Head>
      <DashboardLayout>
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <Link
              href="/managed-services"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 group"
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
              <span className="font-medium">Back to Managed Services</span>
            </Link>

            <div className="flex items-center gap-3">
              {canEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm flex items-center gap-2"
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
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Edit Request
                </button>
              )}
              {request.stage === "payment_pending" ? (
                <button
                  onClick={handleDeleteClick}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg hover:bg-red-100 font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete
                </button>
              ) : (
                <div className="w-[100px]"></div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            <div className="p-8 border-b border-gray-200">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {request.category}
                  </h1>
                  <p className="text-gray-600">ID: {request._id}</p>
                </div>
                <span className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-semibold text-sm">
                  Managed Sourcing
                </span>
              </div>

              {/* Timeline */}
              <div className="mt-8 relative">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-1/2 rounded-full hidden md:block"></div>
                <div className="relative flex flex-col md:flex-row justify-between gap-8 md:gap-0">
                  {STAGES.map((stage, index) => {
                    const isCompleted = index <= currentStep;
                    const isCurrent = index === currentStep;

                    return (
                      <div
                        key={stage.id}
                        className="flex md:flex-col items-center gap-4 md:gap-3 relative z-10 bg-white md:bg-transparent p-2 md:p-0 rounded-lg"
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                            isCompleted
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "bg-white border-gray-300 text-gray-400"
                          }`}
                        >
                          {isCompleted ? (
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
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : (
                            <span className="text-sm font-bold">
                              {index + 1}
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-sm font-medium ${
                            isCurrent
                              ? "text-blue-700 font-bold"
                              : isCompleted
                              ? "text-gray-900"
                              : "text-gray-500"
                          }`}
                        >
                          {stage.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Action Area / Details */}
            <div className="p-8 bg-gray-50">
              {request.stage === "payment_pending" ? (
                // Always show "Make Payment" button when payment is pending
                // The backend will handle creating a new session or updating existing one
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
                        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Complete Payment
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Pay the service fee to start your managed sourcing request.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium text-gray-700">
                        Service Fee
                      </span>
                      <span className="text-2xl font-bold text-blue-700">
                        ${request.serviceFeeAmount}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!request.email) {
                        toast.error("Email not found. Please contact support.");
                        return;
                      }
                      if (!request.serviceFeeAmount) {
                        toast.error(
                          "Service fee amount not found. Please contact support."
                        );
                        return;
                      }
                      serviceFeePaymentMutation.mutate({
                        amount: request.serviceFeeAmount * 100, // Convert to cents
                        email: request.email,
                      });
                    }}
                    disabled={
                      serviceFeePaymentMutation.isPending ||
                      !request.serviceFeeAmount
                    }
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-bold transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {serviceFeePaymentMutation.isPending
                      ? "Processing..."
                      : `Pay $${request.serviceFeeAmount || 0} with Stripe`}
                  </button>
                  {canEdit && (
                    <p className="text-sm text-blue-600 mt-4">
                      You can still edit your request details before payment.
                    </p>
                  )}
                  <button
                    onClick={handleDeleteClick}
                    disabled={deleteMutation.isPending}
                    className="mt-4 w-full px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg hover:bg-red-100 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Delete Request
                  </button>
                </div>
              ) : request.stage === "report_ready" ||
                request.stage === "final_report" ? (
                <div className="space-y-6">
                  {(request.savingsAmount || 0) > 0 &&
                  request.savingsFeeStatus !== "paid" ? (
                    syncPaymentMutation.isPending ? (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600"></div>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                          Processing
                        </h2>
                        <p className="text-gray-600">
                          Please wait while we verify your payment...
                        </p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg
                            className="w-8 h-8 text-green-600"
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
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                          Sourcing Report Ready
                        </h2>
                        <div className="max-w-md mx-auto mt-6 mb-8">
                          <p className="text-gray-600 mb-6">
                            Great news! We found potential savings for your
                            request. To unlock the full supplier report and
                            contact details, a savings fee of{" "}
                            <strong>${request.savingsFeeAmount}</strong> (8% of
                            savings) is required.
                          </p>
                          <div className="bg-green-50 rounded-lg p-4 mb-6">
                            <div className="flex justify-between mb-2">
                              <span className="text-green-800">
                                Identified Savings
                              </span>
                              <span className="font-bold text-green-800">
                                ${request.savingsAmount}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-green-700">Fee (8%)</span>
                              <span className="font-bold text-green-700">
                                ${request.savingsFeeAmount}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => savingsFeePaymentMutation.mutate()}
                            disabled={savingsFeePaymentMutation.isPending}
                            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-bold transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {savingsFeePaymentMutation.isPending
                              ? "Processing..."
                              : "Pay Fee & Unlock Report"}
                          </button>
                        </div>
                      </div>
                    )
                  ) : request.finalReport ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                      <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                          Final Sourcing Report
                        </h2>
                        {request.finalReport.reportGeneratedAt && (
                          <p className="text-sm text-gray-600">
                            Generated on{" "}
                            {new Date(
                              request.finalReport.reportGeneratedAt
                            ).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      {/* Summary - Only show if report is not fully unlocked (savings fee not paid) */}
                      {request.finalReport.summary &&
                        request.savingsFeeStatus !== "paid" &&
                        (request.savingsAmount || 0) > 0 && (
                          <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">
                              Summary
                            </h3>
                            <p className="text-gray-700 leading-relaxed">
                              {request.finalReport.summary}
                            </p>
                          </div>
                        )}

                      {/* Recommendations */}
                      {request.finalReport.recommendations && (
                        <div className="mb-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-3">
                            Recommendations
                          </h3>
                          <p className="text-gray-700 leading-relaxed">
                            {request.finalReport.recommendations}
                          </p>
                        </div>
                      )}

                      {/* Supplier Details */}
                      {request.finalReport.supplierDetails &&
                        request.finalReport.supplierDetails.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                              Supplier Details
                            </h3>
                            <div className="space-y-6">
                              {request.finalReport.supplierDetails.map(
                                (
                                  supplier: {
                                    supplierName?: string;
                                    location?: string;
                                    contactEmail?: string;
                                    contactPhone?: string;
                                    quoteAmount?: number;
                                    negotiatedAmount?: number;
                                    currency?: string;
                                    leadTime?: string;
                                    minimumOrderQuantity?: string;
                                    notes?: string;
                                    isRecommended?: boolean;
                                    images?: string[];
                                    documents?: string[];
                                    quoteDocument?: string;
                                  },
                                  index: number
                                ) => (
                                  <div
                                    key={index}
                                    className={`border-2 rounded-lg p-6 ${
                                      supplier.isRecommended
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-gray-200 bg-white"
                                    }`}
                                  >
                                    {supplier.isRecommended && (
                                      <div className="mb-4">
                                        <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-semibold">
                                          Recommended Supplier
                                        </span>
                                      </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                      <div>
                                        <h4 className="text-xl font-bold text-gray-900 mb-2">
                                          {supplier.supplierName ||
                                            `Supplier ${index + 1}`}
                                        </h4>
                                        <p className="text-sm text-gray-600 mb-1">
                                          📍 {supplier.location}
                                        </p>
                                        {supplier.contactEmail && (
                                          <p className="text-sm text-gray-600 mb-1">
                                            ✉️{" "}
                                            <a
                                              href={`mailto:${supplier.contactEmail}`}
                                              className="text-blue-600 hover:underline"
                                            >
                                              {supplier.contactEmail}
                                            </a>
                                          </p>
                                        )}
                                        {supplier.contactPhone && (
                                          <p className="text-sm text-gray-600">
                                            📞{" "}
                                            <a
                                              href={`tel:${supplier.contactPhone}`}
                                              className="text-blue-600 hover:underline"
                                            >
                                              {supplier.contactPhone}
                                            </a>
                                          </p>
                                        )}
                                      </div>
                                      <div className="space-y-2">
                                        {supplier.quoteAmount &&
                                          supplier.quoteAmount > 0 && (
                                            <div>
                                              <span className="text-sm font-medium text-gray-600">
                                                Quote Amount:{" "}
                                              </span>
                                              <span className="text-lg font-bold text-gray-900">
                                                $
                                                {supplier.quoteAmount.toLocaleString()}{" "}
                                                {supplier.currency || "USD"}
                                              </span>
                                            </div>
                                          )}
                                        {supplier.negotiatedAmount &&
                                          supplier.negotiatedAmount > 0 &&
                                          supplier.quoteAmount &&
                                          supplier.negotiatedAmount !==
                                            supplier.quoteAmount && (
                                            <div>
                                              <span className="text-sm font-medium text-gray-600">
                                                Negotiated Amount:{" "}
                                              </span>
                                              <span className="text-lg font-bold text-green-600">
                                                $
                                                {supplier.negotiatedAmount.toLocaleString()}{" "}
                                                {supplier.currency || "USD"}
                                              </span>
                                              {supplier.quoteAmount >
                                                supplier.negotiatedAmount && (
                                                <div className="mt-1 text-xs text-green-600">
                                                  Savings: $
                                                  {(
                                                    supplier.quoteAmount -
                                                    supplier.negotiatedAmount
                                                  ).toLocaleString()}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        {supplier.negotiatedAmount &&
                                          supplier.negotiatedAmount > 0 &&
                                          supplier.quoteAmount &&
                                          supplier.negotiatedAmount ===
                                            supplier.quoteAmount && (
                                            <div>
                                              <span className="text-sm font-medium text-gray-600">
                                                Final Amount:{" "}
                                              </span>
                                              <span className="text-lg font-bold text-gray-900">
                                                $
                                                {supplier.negotiatedAmount.toLocaleString()}{" "}
                                                {supplier.currency || "USD"}
                                              </span>
                                            </div>
                                          )}
                                        {supplier.leadTime && (
                                          <div>
                                            <span className="text-sm font-medium text-gray-600">
                                              Lead Time:{" "}
                                            </span>
                                            <span className="text-sm text-gray-900">
                                              {supplier.leadTime}
                                            </span>
                                          </div>
                                        )}
                                        {supplier.minimumOrderQuantity && (
                                          <div>
                                            <span className="text-sm font-medium text-gray-600">
                                              Min Order:{" "}
                                            </span>
                                            <span className="text-sm text-gray-900">
                                              {supplier.minimumOrderQuantity}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {supplier.quoteDocument && (
                                      <div className="mt-4 pt-4 border-t border-gray-200">
                                        <p className="text-sm font-medium text-gray-700 mb-2">
                                          Quote Document:
                                        </p>
                                        <a
                                          href={supplier.quoteDocument}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
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
                                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                            />
                                          </svg>
                                          View Quote Document
                                        </a>
                                      </div>
                                    )}
                                    {supplier.notes && (
                                      <div className="mt-4 pt-4 border-t border-gray-200">
                                        <p className="text-sm text-gray-700">
                                          {supplier.notes}
                                        </p>
                                      </div>
                                    )}
                                    {(supplier.images &&
                                      supplier.images.length > 0) ||
                                    (supplier.documents &&
                                      supplier.documents.length > 0) ? (
                                      <div className="mt-4 pt-4 border-t border-gray-200">
                                        {supplier.images &&
                                          supplier.images.length > 0 && (
                                            <div className="mb-3">
                                              <p className="text-sm font-medium text-gray-700 mb-2">
                                                Images:
                                              </p>
                                              <div className="flex flex-wrap gap-2">
                                                {supplier.images.map(
                                                  (
                                                    url: string,
                                                    imgIndex: number
                                                  ) => (
                                                    <a
                                                      key={imgIndex}
                                                      href={url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="text-sm text-blue-600 hover:underline"
                                                    >
                                                      Image {imgIndex + 1}
                                                    </a>
                                                  )
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        {supplier.documents &&
                                          supplier.documents.length > 0 && (
                                            <div>
                                              <p className="text-sm font-medium text-gray-700 mb-2">
                                                Documents:
                                              </p>
                                              <div className="flex flex-wrap gap-2">
                                                {supplier.documents.map(
                                                  (
                                                    url: string,
                                                    docIndex: number
                                                  ) => (
                                                    <a
                                                      key={docIndex}
                                                      href={url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="text-sm text-blue-600 hover:underline"
                                                    >
                                                      Document {docIndex + 1}
                                                    </a>
                                                  )
                                                )}
                                              </div>
                                            </div>
                                          )}
                                      </div>
                                    ) : null}
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}

                      {/* Additional Notes */}
                      {request.finalReport.additionalNotes && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <h3 className="text-lg font-semibold text-gray-900 mb-3">
                            Additional Notes
                          </h3>
                          <p className="text-gray-700 leading-relaxed">
                            {request.finalReport.additionalNotes}
                          </p>
                        </div>
                      )}

                      {/* Feedback Button */}
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <Link
                          href={`/feedback?type=matching_service&matchingServiceId=${serviceId}`}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors shadow-sm hover:shadow-md"
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
                              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                            />
                          </svg>
                          Share Your Feedback
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg
                          className="w-8 h-8 text-green-600"
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
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Sourcing Report Ready
                      </h2>
                      <div className="max-w-md mx-auto mt-6 mb-8">
                        <p className="text-gray-600 mb-6">
                          We have completed your sourcing request. No additional
                          savings fee applies as the negotiated price was within
                          your original budget without significant reduction.
                        </p>
                        <p className="text-sm text-gray-500 mb-6">
                          The detailed report will be available shortly.
                        </p>
                        <Link
                          href={`/feedback?type=matching_service&matchingServiceId=${serviceId}`}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors shadow-sm hover:shadow-md"
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
                              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                            />
                          </svg>
                          Share Your Feedback
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Request Details
                    </h3>
                    <dl className="space-y-4">
                      <div>
                        <dt className="text-sm text-gray-500">
                          Specifications
                        </dt>
                        <dd className="text-sm font-medium text-gray-900 mt-1">
                          {request.specifications}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Quantity</dt>
                        <dd className="text-sm font-medium text-gray-900 mt-1">
                          {request.quantity}
                        </dd>
                      </div>
                      {request.urgency && (
                        <div>
                          <dt className="text-sm text-gray-500">Urgency</dt>
                          <dd className="text-sm font-medium text-gray-900 mt-1 capitalize">
                            {request.urgency}
                            {request.urgencyDuration && (
                              <span className="text-gray-600 ml-2">
                                ({request.urgencyDuration})
                              </span>
                            )}
                          </dd>
                        </div>
                      )}
                      {request.daysLeft !== undefined && (
                        <div>
                          <dt className="text-sm text-gray-500">Days Left</dt>
                          <dd className="text-sm mt-1">
                            <span
                              className={`font-semibold px-2 py-1 rounded ${
                                request.isOverdue
                                  ? "bg-red-100 text-red-800"
                                  : request.daysLeft <= 2
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {request.isOverdue
                                ? `Overdue by ${Math.abs(
                                    request.daysLeft
                                  )} days`
                                : `${request.daysLeft} days left`}
                            </span>
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-sm text-gray-500">
                          Delivery Location
                        </dt>
                        <dd className="text-sm font-medium text-gray-900 mt-1">
                          {request.deliveryLocation}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Current Status
                    </h3>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                      <p className="text-blue-900 font-medium mb-1">
                        {STAGES.find((s) => s.id === request.stage)?.label ||
                          "Processing"}
                      </p>
                      <p className="text-blue-700 text-sm">
                        Our team is currently working on this stage. You will
                        receive an email update when we move to the next step.
                      </p>
                      {canEdit && (
                        <div className="mt-3 pt-3 border-t border-blue-200">
                          <p className="text-xs text-blue-800">
                            You can still update your request details in this
                            stage.
                          </p>
                          <button
                            onClick={() => setIsEditing(true)}
                            className="mt-2 text-sm text-blue-600 font-medium hover:text-blue-800 underline"
                          >
                            Edit Request
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Edit Modal */}
          {isEditing && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
              <div className="flex min-h-screen items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900">
                      Edit Request
                    </h2>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="text-gray-400 hover:text-gray-600"
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
                  <div className="p-6">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        updateMutation.mutate(editFormData);
                      }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Category
                          {request.stage !== "payment_pending" && (
                            <span className="ml-2 text-xs text-gray-500">
                              (Cannot be changed after payment)
                            </span>
                          )}
                        </label>
                        <select
                          value={editFormData.category}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              category: e.target.value,
                            })
                          }
                          disabled={request.stage !== "payment_pending"}
                          className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                            request.stage !== "payment_pending"
                              ? "bg-gray-100 cursor-not-allowed opacity-60"
                              : ""
                          }`}
                          required={request.stage === "payment_pending"}
                        >
                          <option value="">Select category</option>
                          {categories.map((cat: Category) => (
                            <option key={cat._id} value={cat.name}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                        {request.stage !== "payment_pending" && (
                          <p className="mt-1 text-xs text-gray-500">
                            Category is locked after payment because it affects
                            the service fee price.
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Specifications
                        </label>
                        <textarea
                          value={editFormData.specifications}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              specifications: e.target.value,
                            })
                          }
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quantity
                          </label>
                          <input
                            type="text"
                            value={editFormData.quantity}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                quantity: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Delivery Location
                          </label>
                          <input
                            type="text"
                            value={editFormData.deliveryLocation}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                deliveryLocation: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Target Budget
                          </label>
                          <input
                            type="text"
                            value={editFormData.budget}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                budget: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Deadline
                          </label>
                          <input
                            type="date"
                            value={editFormData.deadline}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                deadline: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="pt-4 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={updateMutation.isPending}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {updateMutation.isPending
                            ? "Saving..."
                            : "Save Changes"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                <div className="p-6">
                  <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                    <svg
                      className="w-6 h-6 text-red-600"
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
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                    Delete Request?
                  </h3>
                  <p className="text-sm text-gray-600 text-center mb-6">
                    Are you sure you want to delete this request? This action
                    cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDeleteCancel}
                      disabled={deleteMutation.isPending}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteConfirm}
                      disabled={deleteMutation.isPending}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {deleteMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Deleting...
                        </>
                      ) : (
                        "Delete"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  );
}

export async function getServerSideProps() {
  // This page requires server-side rendering for dynamic routes
  return {
    props: {},
  };
}
