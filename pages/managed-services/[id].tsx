import { useEffect, useRef, useState } from "react";
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
  getSubcategories,
  getSystemSettings,
  Category,
} from "@/api";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/DashboardLayout";
import DatePicker from "@/components/DatePicker";
import Link from "next/link";
import { AxiosError } from "axios";
import Head from "next/head";
import { generateManagedServiceReportPDF } from "@/utils/generatePDF";

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
  "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
  "Washington", "West Virginia", "Wisconsin", "Wyoming",
];


const formatBudget = (raw?: string): string => {
  if (!raw) return "";
  return raw.replace(
    /\$?\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{3,}(?:\.\d+)?)/g,
    (_match, num: string) => {
      const value = Number(num.replace(/,/g, ""));
      if (!Number.isFinite(value)) return _match;
      return `$${value.toLocaleString("en-US")}`;
    },
  );
};

interface UploadedDocument {
  name?: string;
  fileName: string;
  type: string;
  url: string;
}

const STAGES = [
  { id: "review", label: "Project Review" },
  { id: "rfq_prep", label: "RFQ/RFP Preparation" },
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

  // Track when we're processing a just-completed payment (show loader until sync finishes)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<{
    itemName: string;
    category: string;
    subCategory: string;
    quantity: string;
    description: string;
    estimatedSpendRange: string;
    urgency: string;
    complianceLevel: "commercial" | "government" | "regulated";
    deliveryLocation: string;
    internalDeadline: string;
  }>({
    itemName: "",
    category: "",
    subCategory: "",
    quantity: "",
    description: "",
    estimatedSpendRange: "",
    urgency: "",
    complianceLevel: "commercial",
    deliveryLocation: "",
    internalDeadline: "",
  });

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);


  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    doc: UploadedDocument | null;
    blobUrl: string | null;
    isLoading: boolean;
  }>({
    isOpen: false,
    doc: null,
    blobUrl: null,
    isLoading: false,
  });

  // Poll every 30 seconds for updates
  const {
    data: requestData,
    isLoading,
    refetch,
    error: requestError,
  } = useQuery({
    queryKey: ["managedService", serviceId],
    queryFn: () => getManagedServiceDetails(serviceId),
    enabled: !!serviceId && router.isReady,
    refetchInterval: 30000,
    retry: false,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
    enabled: isEditing,
  });

  const categories = categoriesData?.data || [];

  const selectedCategoryObj = categories.find(
    (cat: Category) => cat.name === editFormData.category
  );

  const { data: subcategoriesData } = useQuery({
    queryKey: ["subcategories", selectedCategoryObj?._id],
    queryFn: () => getSubcategories(selectedCategoryObj!._id),
    enabled: isEditing && !!selectedCategoryObj?._id,
  });

  const subcategories = subcategoriesData?.data || [];

  const { data: settingsData } = useQuery({
    queryKey: ["systemSettings", "public"],
    queryFn: getSystemSettings,
    enabled: isEditing,
  });

  const urgencyFees = settingsData?.data?.urgencyFees || {
    standard: { fee: 0, duration: "5-7 days" },
    expedited: { fee: 500, duration: "2-3 days" },
    emergency: { fee: 1000, duration: "24-48 hrs" },
  };
  const availableUrgencies = Object.keys(urgencyFees);

  const syncPaymentMutation = useMutation({
    mutationFn: () => syncManagedServicePayment(serviceId),
    onSuccess: (data) => {
      setIsProcessingPayment(false);
      if (data.success) {
        toast.success(data.message || "Payment status synced successfully");
        refetch();
      } else {
        toast.error(data.message || "Failed to sync payment status");
      }
    },
    onError: (error: unknown) => {
      setIsProcessingPayment(false);
      const errorMessage =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || "Failed to sync payment status";
      toast.error(errorMessage);
    },
  });

  const serviceFeePaymentMutation = useMutation({
    // The backend derives amount + email from the request + auth session,
    // so the client only needs to identify the request.
    mutationFn: () => createServiceFeePaymentSession(serviceId),
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

  // Document helpers
  const openDocument = async (doc: UploadedDocument): Promise<void> => {
    setPreviewModal({ isOpen: true, doc, blobUrl: null, isLoading: true });
    try {
      const response = await fetch(getFullImageUrl(doc.url));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPreviewModal({ isOpen: true, doc, blobUrl, isLoading: false });
    } catch (error) {
      console.error("Preview failed:", error);
      toast.error("Failed to load preview");
      setPreviewModal({ isOpen: false, doc: null, blobUrl: null, isLoading: false });
    }
  };

  const closePreview = (): void => {
    if (previewModal.blobUrl) URL.revokeObjectURL(previewModal.blobUrl);
    setPreviewModal({ isOpen: false, doc: null, blobUrl: null, isLoading: false });
  };

  // Revoke any outstanding blob URL on unmount.
  useEffect(() => {
    return () => {
      if (previewModal.blobUrl) URL.revokeObjectURL(previewModal.blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadDocument = async (doc: UploadedDocument): Promise<void> => {
    try {
      const fullUrl = getFullImageUrl(doc.url);
      const response = await fetch(fullUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Failed to download file");
    }
  };

  const getFullImageUrl = (url: string): string => {
    if (url.startsWith("http")) return url;
    // Same-origin via Next.js rewrites — leading-slash paths resolve here.
    return url;
  };


  const [paymentRecentlyConfirmed, setPaymentRecentlyConfirmed] = useState(false);
  const paymentArrivedRef = useRef(false);
  useEffect(() => {
    if (
      paymentStatus === "success" &&
      router.isReady &&
      !paymentArrivedRef.current
    ) {
      paymentArrivedRef.current = true;
      setPaymentRecentlyConfirmed(true);
      setIsProcessingPayment(true);
      // Strip the query param right away so a refresh doesn't re-trigger this.
      router.replace(`/managed-services/${serviceId}`, undefined, {
        shallow: true,
      });
      // Give the webhook a couple of seconds to fire, then nudge sync + refetch.
      const t = setTimeout(() => {
        syncPaymentMutation.mutate();
        refetch();
      }, 2000);
     
      const release = setTimeout(() => {
        setPaymentRecentlyConfirmed(false);
      }, 30000);
      return () => {
        clearTimeout(t);
        clearTimeout(release);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentStatus, router.isReady]);


  const successToastShownRef = useRef(false);
  useEffect(() => {
    const stage = requestData?.data?.stage;
    if (
      paymentRecentlyConfirmed &&
      stage &&
      stage !== "payment_pending" &&
      !successToastShownRef.current
    ) {
      successToastShownRef.current = true;
      toast.success("Payment confirmed");
      setPaymentRecentlyConfirmed(false);
    }
  }, [paymentRecentlyConfirmed, requestData]);

  const request = requestData?.data;

  // Initialize edit form when opening edit mode
  useEffect(() => {
    if (isEditing && request) {
      
      const rawDeadline = request.internalDeadline || request.deadline || "";
      const normalizedDeadline = rawDeadline
        ? new Date(rawDeadline).toISOString().split("T")[0]
        : "";
      const allowedCompliance = ["commercial", "government", "regulated"] as const;
      const compliance = allowedCompliance.includes(
        request.complianceLevel as (typeof allowedCompliance)[number]
      )
        ? request.complianceLevel
        : "commercial";
      setEditFormData({
        itemName: request.itemName || "",
        category: request.category || "",
        subCategory: request.subCategory || "",
        quantity: request.quantity || "",
        description: request.description || request.specifications || "",
        estimatedSpendRange: request.estimatedSpendRange || request.budget || "",
        urgency: request.urgency || "",
        complianceLevel: compliance,
        deliveryLocation: request.deliveryLocation || "",
        internalDeadline: normalizedDeadline,
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

 
  const stillSyncingPayment =
    paymentRecentlyConfirmed || syncPaymentMutation.isPending;
  const dataLooksStaleAfterPayment =
    !!request &&
    request.stage === "payment_pending" &&
    stillSyncingPayment;
  if (
    (!request && (isProcessingPayment || stillSyncingPayment)) ||
    dataLooksStaleAfterPayment
  ) {
    return (
      <>
        <Head>
          <title>Processing Payment - Optiverifi</title>
        </Head>
        <DashboardLayout>
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600"></div>
            </div>
            <div className="text-center max-w-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Processing your payment
              </h2>
              <p className="text-gray-500 text-sm">
                We&apos;re confirming your payment with Stripe. This usually
                takes a few seconds.
              </p>
            </div>
          </div>
        </DashboardLayout>
      </>
    );
  }

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
  
    const apiErrorMessage = (() => {
      const e = requestError as
        | {
            response?: { data?: { message?: string }; status?: number };
            message?: string;
          }
        | undefined;
      return (
        e?.response?.data?.message ||
        e?.message ||
        "We couldn't load this request."
      );
    })();
    const apiStatus = (
      requestError as { response?: { status?: number } } | undefined
    )?.response?.status;

    return (
      <>
        <Head>
          <title>Request Not Found - Optiverifi</title>
        </Head>
        <DashboardLayout>
          <div className="max-w-md mx-auto text-center py-16">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-amber-500"
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
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              We couldn&apos;t load this request
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              {apiErrorMessage}
              {apiStatus ? ` (${apiStatus})` : ""}
            </p>
            <div className="grid gap-3">
              <button
                onClick={() => syncPaymentMutation.mutate()}
                disabled={syncPaymentMutation.isPending}
                className="w-full py-3 px-6 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {syncPaymentMutation.isPending
                  ? "Syncing payment..."
                  : "I just paid, sync now"}
              </button>
              <button
                onClick={() => refetch()}
                className="w-full py-3 px-6 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Refresh
              </button>
              <Link
                href="/managed-services"
                className="text-gray-500 hover:text-gray-700 text-sm mt-2"
              >
                Back to Managed Services
              </Link>
            </div>
            <p className="text-xs text-gray-400 mt-6">
              If this keeps happening after a successful payment, contact
              support with this request ID:{" "}
              <span className="font-mono">{serviceId}</span>
            </p>
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
                    {request.itemName}
                  </h1>
                  <p className="text-gray-600">
                    {request.category}
                    {request.subCategory && (
                      <span className="text-gray-500"> · {request.subCategory}</span>
                    )}
                  </p>
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
                      if (!request.serviceFeeAmount) {
                        toast.error(
                          "Service fee amount not found. Please contact support."
                        );
                        return;
                      }
                      // Backend computes amount + email server-side from the
                      // request record and authenticated user.
                      serviceFeePaymentMutation.mutate();
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
                      {/* Request Details Section */}
                      <div className="mb-8 pb-8 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          Request Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                              Item Name
                            </p>
                            <p className="text-sm text-gray-900 font-medium">
                              {request.itemName}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                              Date Created
                            </p>
                            <p className="text-sm text-gray-900">
                              {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                              Service Fee (Paid)
                            </p>
                            <p className="text-sm text-gray-900 font-medium">
                              ${request.serviceFeeAmount || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                              Quantity
                            </p>
                            <p className="text-sm text-gray-900">
                              {request.quantity}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                              Urgency
                            </p>
                            <p className="text-sm text-gray-900 capitalize">
                              {request.urgency}
                            </p>
                          </div>
                          {request.urgencyDuration && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Urgency Duration
                              </p>
                              <p className="text-sm text-gray-900">
                                {request.urgencyDuration}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                              Compliance Level
                            </p>
                            <p className="text-sm text-gray-900 capitalize">
                              {request.complianceLevel}
                            </p>
                          </div>
                          {request.daysLeft !== undefined && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Days Left
                              </p>
                              <p
                                className={`text-sm font-medium ${
                                  request.isOverdue
                                    ? "text-red-600"
                                    : "text-gray-900"
                                }`}
                              >
                                {request.isOverdue ? "Overdue" : `${request.daysLeft} days`}
                              </p>
                            </div>
                          )}
                        </div>
                        {request.description && (
                          <div className="mt-6">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                              Description
                            </p>
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {request.description}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Final Report Section */}
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

                      {/* Summary */}
                      {request.finalReport.summary && (
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
                                    uploadedDocuments?: UploadedDocument[];
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
                                        {(supplier.quoteAmount ?? 0) > 0 && (
                                            <div>
                                              <span className="text-sm font-medium text-gray-600">
                                                Quote Amount:{" "}
                                              </span>
                                              <span className="text-lg font-bold text-gray-900">
                                                $
                                                {supplier.quoteAmount!.toLocaleString()}{" "}
                                                {supplier.currency || "USD"}
                                              </span>
                                            </div>
                                          )}
                                        {(supplier.negotiatedAmount ?? 0) > 0 &&
                                          (supplier.quoteAmount ?? 0) > 0 &&
                                          supplier.negotiatedAmount !==
                                            supplier.quoteAmount && (
                                            <div>
                                              <span className="text-sm font-medium text-gray-600">
                                                Negotiated Amount:{" "}
                                              </span>
                                              <span className="text-lg font-bold text-green-600">
                                                $
                                                {supplier.negotiatedAmount!.toLocaleString()}{" "}
                                                {supplier.currency || "USD"}
                                              </span>
                                              {supplier.quoteAmount! >
                                                supplier.negotiatedAmount! && (
                                                <div className="mt-1 text-xs text-green-600">
                                                  Savings: $
                                                  {(
                                                    supplier.quoteAmount! -
                                                    supplier.negotiatedAmount!
                                                  ).toLocaleString()}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        {(supplier.negotiatedAmount ?? 0) > 0 &&
                                          (supplier.quoteAmount ?? 0) > 0 &&
                                          supplier.negotiatedAmount ===
                                            supplier.quoteAmount && (
                                            <div>
                                              <span className="text-sm font-medium text-gray-600">
                                                Final Amount:{" "}
                                              </span>
                                              <span className="text-lg font-bold text-gray-900">
                                                $
                                                {supplier.negotiatedAmount!.toLocaleString()}{" "}
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
                                    {supplier.notes && (
                                      <div className="mt-4 pt-4 border-t border-gray-200">
                                        <p className="text-sm text-gray-700">
                                          {supplier.notes}
                                        </p>
                                      </div>
                                    )}
                                    {supplier.uploadedDocuments &&
                                      supplier.uploadedDocuments.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-gray-200">
                                          <p className="text-sm font-medium text-gray-700 mb-3">
                                            Uploaded Documents
                                          </p>
                                          <div className="space-y-2">
                                            {supplier.uploadedDocuments.map(
                                              (doc: UploadedDocument, docIndex: number) => (
                                                <div
                                                  key={docIndex}
                                                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                                                >
                                                  <div className="flex-shrink-0">
                                                    {doc.type === "application/pdf" ? (
                                                      <svg
                                                        className="w-6 h-6 text-red-500"
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
                                                    ) : (
                                                      <svg
                                                        className="w-6 h-6 text-blue-500"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                      >
                                                        <path
                                                          strokeLinecap="round"
                                                          strokeLinejoin="round"
                                                          strokeWidth={2}
                                                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                                        />
                                                      </svg>
                                                    )}
                                                  </div>

                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">
                                                      {doc.name || doc.fileName}
                                                    </p>
                                                    {doc.name && (
                                                      <p className="text-xs text-gray-500 truncate">
                                                        {doc.fileName}
                                                      </p>
                                                    )}
                                                  </div>

                                                  <div className="flex items-center gap-2 flex-shrink-0">
                                                    <button
                                                      onClick={() =>
                                                        openDocument(doc)
                                                      }
                                                      className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                                                    >
                                                      Preview
                                                    </button>
                                                    <button
                                                      onClick={() =>
                                                        downloadDocument(doc)
                                                      }
                                                      className="text-xs text-gray-600 hover:text-gray-800 font-medium px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                                                    >
                                                      Download
                                                    </button>
                                                  </div>
                                                </div>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      )}
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

                      {/* Action Buttons */}
                      <div className="mt-6 pt-6 border-t border-gray-200 flex flex-wrap gap-3">
                        <button
                          onClick={async () => {
                            try {
                              await generateManagedServiceReportPDF(request);
                            } catch (error) {
                              console.error("Error generating PDF:", error);
                              toast.error(
                                "Failed to generate PDF. Please try again."
                              );
                            }
                          }}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors shadow-sm hover:shadow-md"
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
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          Download Report
                        </button>
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
                        <dt className="text-sm text-gray-500">Category</dt>
                        <dd className="text-sm font-medium text-gray-900 mt-1">
                          {request.category}
                        </dd>
                      </div>
                      {request.subCategory && (
                        <div>
                          <dt className="text-sm text-gray-500">Subcategory</dt>
                          <dd className="text-sm font-medium text-gray-900 mt-1">
                            {request.subCategory}
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-sm text-gray-500">Quantity</dt>
                        <dd className="text-sm font-medium text-gray-900 mt-1">
                          {request.quantity}
                        </dd>
                      </div>
                      {(request.description || request.specifications) && (
                        <div>
                          <dt className="text-sm text-gray-500">Description</dt>
                          <dd className="text-sm font-medium text-gray-900 mt-1 whitespace-pre-line">
                            {request.description || request.specifications}
                          </dd>
                        </div>
                      )}
                      {(request.estimatedSpendRange || request.budget) && (
                        <div>
                          <dt className="text-sm text-gray-500">Budget</dt>
                          <dd className="text-sm font-medium text-gray-900 mt-1">
                            {formatBudget(
                              request.estimatedSpendRange || request.budget,
                            )}
                          </dd>
                        </div>
                      )}
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
                      {request.complianceLevel && (
                        <div>
                          <dt className="text-sm text-gray-500">
                            Compliance Level
                          </dt>
                          <dd className="text-sm font-medium text-gray-900 mt-1 capitalize">
                            {request.complianceLevel}
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
                      {(request.internalDeadline || request.deadline) && (
                        <div>
                          <dt className="text-sm text-gray-500">
                            Internal Deadline
                          </dt>
                          <dd className="text-sm font-medium text-gray-900 mt-1">
                            {new Date(
                              request.internalDeadline || request.deadline || ""
                            ).toLocaleDateString()}
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
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateMutation.mutate(editFormData);
                  }}
                  className="flex flex-col min-h-0 flex-1"
                >
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-900">
                      Edit Request
                    </h2>
                    <button
                      type="button"
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
                  <div className="p-6 overflow-y-auto flex-1 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Item Name
                        </label>
                        <input
                          type="text"
                          value={editFormData.itemName}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              itemName: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Category
                            {request.stage !== "payment_pending" && (
                              <span className="ml-2 text-xs text-gray-500">
                                (Locked after payment)
                              </span>
                            )}
                          </label>
                          <select
                            value={editFormData.category}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                category: e.target.value,
                                subCategory: "",
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
                        </div>
                        {subcategories.length > 0 && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Subcategory
                              <span className="ml-2 text-xs text-gray-500">
                                (Optional)
                              </span>
                            </label>
                            <select
                              value={editFormData.subCategory}
                              onChange={(e) =>
                                setEditFormData({
                                  ...editFormData,
                                  subCategory: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Select subcategory</option>
                              {subcategories.map((sub) => (
                                <option key={sub._id} value={sub.name}>
                                  {sub.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
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
                          placeholder="e.g., 5000 units"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={editFormData.description}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              description: e.target.value,
                            })
                          }
                          rows={4}
                          placeholder="Describe exactly what you need (materials, dimensions, standards, etc.)"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Budget
                        </label>
                        <input
                          type="text"
                          value={editFormData.estimatedSpendRange}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              estimatedSpendRange: e.target.value,
                            })
                          }
                          placeholder="e.g., $10,000 - $15,000"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Urgency
                        </label>
                        <div className="space-y-2">
                          {availableUrgencies.map((urgency) => {
                            const data = urgencyFees[urgency];
                            const fee = typeof data === "object" ? data.fee : data;
                            const duration =
                              typeof data === "object" ? data.duration : "";
                            return (
                              <label
                                key={urgency}
                                className="flex items-center gap-3 cursor-pointer"
                              >
                                <input
                                  type="radio"
                                  name="urgency-edit"
                                  value={urgency}
                                  checked={editFormData.urgency === urgency}
                                  onChange={(e) =>
                                    setEditFormData({
                                      ...editFormData,
                                      urgency: e.target.value,
                                    })
                                  }
                                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-900">
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Compliance Level
                        </label>
                        <select
                          value={editFormData.complianceLevel}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              complianceLevel: e.target.value as
                                | "commercial"
                                | "government"
                                | "regulated",
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="commercial">Commercial</option>
                          <option value="government">Government</option>
                          <option value="regulated">Regulated</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Delivery Location
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              Country
                            </label>
                            <input
                              type="text"
                              value="United States"
                              disabled
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              State
                            </label>
                            <select
                              value={editFormData.deliveryLocation}
                              onChange={(e) =>
                                setEditFormData({
                                  ...editFormData,
                                  deliveryLocation: e.target.value,
                                })
                              }
                              required
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Select state</option>
                              {US_STATES.map((state) => (
                                <option key={state} value={state}>
                                  {state}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Internal Deadline
                        </label>
                        <DatePicker
                          value={editFormData.internalDeadline}
                          onChange={(date) =>
                            setEditFormData({
                              ...editFormData,
                              internalDeadline: date,
                            })
                          }
                          minDate={new Date().toISOString().split("T")[0]}
                          placeholder="Select deadline date"
                        />
                      </div>
                  </div>
                  <div className="p-6 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0 bg-white rounded-b-xl">
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

          {/* Document Preview Modal */}
          {previewModal.isOpen && previewModal.doc && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {previewModal.doc.name || previewModal.doc.fileName}
                    </h3>
                    {previewModal.doc.name && (
                      <p className="text-sm text-gray-600">
                        {previewModal.doc.fileName}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={closePreview}
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
                <div className="p-6">
                  {previewModal.isLoading ? (
                    <div className="flex justify-center items-center h-[500px]">
                      <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600"></div>
                    </div>
                  ) : previewModal.doc.type === "application/pdf" &&
                    previewModal.blobUrl ? (
                    <iframe
                      src={previewModal.blobUrl}
                      className="w-full h-[500px] border border-gray-200 rounded-lg"
                      title="PDF Preview"
                    />
                  ) : previewModal.doc.type.startsWith("image/") &&
                    previewModal.blobUrl ? (
                    <div className="flex justify-center">
                      <img
                        src={previewModal.blobUrl}
                        alt={previewModal.doc.fileName}
                        className="max-w-full max-h-[500px] rounded-lg border border-gray-200"
                      />
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-600 mb-4">
                        Preview not available for this file type
                      </p>
                      <button
                        onClick={() =>
                          downloadDocument(previewModal.doc!)
                        }
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Download Instead
                      </button>
                    </div>
                  )}
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
