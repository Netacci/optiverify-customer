/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { getReceiptById, Receipt, UploadedDocument } from "@/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import Head from "next/head";
import { useState } from "react";
import toast from "react-hot-toast";
import { generateReceiptPDF } from "@/utils/generatePDF";

// Same-origin via Next.js rewrites — relative URLs resolve against this host.

export default function TransactionDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const transactionId = id as string;

  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    doc: UploadedDocument | null;
  }>({
    isOpen: false,
    doc: null,
  });
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["transaction", transactionId],
    queryFn: () => getReceiptById(transactionId),
    enabled: !!transactionId && router.isReady,
  });

  const transaction = data?.data;

  const handleDownloadReceipt = async () => {
    if (!transaction) return;
    setDownloadingPDF(true);
    try {
      await generateReceiptPDF({
        transactionId: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        paidAt: transaction.paidAt,
        planType: transaction.planType,
        type: transaction.type,
        itemName: transaction.request?.name || transaction.service?.itemName,
        category: transaction.request?.category || transaction.service?.category,
        credits: transaction.credits,
      });
    } catch (err) {
      toast.error("Failed to generate receipt PDF");
    } finally {
      setDownloadingPDF(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number, currency: string = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const getFullImageUrl = (url: string): string => {
    if (url.startsWith("http")) return url;
    // Same-origin via Next.js rewrites — leading-slash paths resolve here.
    return url;
  };

  const openDocument = (doc: UploadedDocument): void => {
    setPreviewModal({ isOpen: true, doc });
  };

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

  const getFileTypeIcon = (doc: UploadedDocument) => {
    const isPdf = doc.type === "application/pdf";
    return isPdf ? (
      <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
        <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
        <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0015.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
      </svg>
    ) : (
      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
      </svg>
    );
  };

  if (isLoading || !router.isReady) {
    return (
      <>
        <Head>
          <title>Transaction Details - Optiverifi</title>
        </Head>
        <DashboardLayout>
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
          </div>
        </DashboardLayout>
      </>
    );
  }

  if (error || !transaction) {
    return (
      <>
        <Head>
          <title>Transaction Not Found - Optiverifi</title>
        </Head>
        <DashboardLayout>
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <svg
                className="w-16 h-16 text-gray-400 mx-auto mb-4"
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
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Transaction not found
              </h2>
              <p className="text-gray-600 mb-6">
                The transaction you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
              </p>
              <Link
                href="/transactions"
                className="text-blue-600 hover:underline font-medium"
              >
                Back to Transactions
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </>
    );
  }

  const getTypeBadge = (type: string) => {
    if (type === "match_report") {
      return (
        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
          Match Report
        </span>
      );
    }
    if (type === "managed_service_savings_fee") {
      return (
        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
          Savings Fee
        </span>
      );
    }
    if (type === "top_up") {
      return (
        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800">
          Top-up
        </span>
      );
    }
    if (type === "subscription") {
      return (
        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800">
          Subscription
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800">
        Managed Service
      </span>
    );
  };

  const getTitle = (transaction: Receipt) => {
    if (transaction.type === "match_report") {
      return transaction.request?.category || "Match Report";
    }
    if (transaction.type === "managed_service_savings_fee") {
      return `Savings Fee - ${transaction.service?.category || "Managed Service"}`;
    }
    if (transaction.type === "top_up") {
      return `Top-up - ${transaction.credits} credit${
        transaction.credits && transaction.credits > 1 ? "s" : ""
      }`;
    }
    if (transaction.type === "subscription") {
      return transaction.subscription?.plan || "Subscription";
    }
    return transaction.service?.category || "Managed Service";
  };

  return (
    <>
      <Head>
        <title>Transaction Details - Optiverifi</title>
      </Head>
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          {/* Header with Back Button */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <Link
                href="/transactions"
                className="text-blue-600 hover:text-blue-900 flex items-center gap-2 mb-4 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Transactions
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">
                {getTitle(transaction)}
              </h1>
            </div>
            <button
              onClick={handleDownloadReceipt}
              disabled={downloadingPDF}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium disabled:opacity-60"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloadingPDF ? "Generating..." : "Download Receipt"}
            </button>
          </div>

          {/* Main Receipt Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            {/* Transaction Header */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-200 mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {getTypeBadge(transaction.type)}
                  {transaction.planType && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {transaction.planType}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  Transaction ID: {transaction.id}
                </p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold text-gray-900">
                  {formatCurrency(transaction.amount, transaction.currency)}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Paid on {formatDate(transaction.paidAt)}
                </p>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">
                  Transaction Info
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Created</p>
                    <p className="text-lg font-medium text-gray-900">
                      {formatDate(transaction.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Currency</p>
                    <p className="text-lg font-medium text-gray-900">
                      {transaction.currency.toUpperCase()}
                    </p>
                  </div>
                  {transaction.paymentMethod && (
                    <div>
                      <p className="text-sm text-gray-600">Payment Method</p>
                      <p className="text-lg font-medium text-gray-900 capitalize">
                        {transaction.paymentMethod}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Request/Service Details */}
              {transaction.type === "match_report" && transaction.request ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">
                    Request Details
                  </h3>
                  <div className="space-y-4">
                    {transaction.request.name && (
                      <div>
                        <p className="text-sm text-gray-600">Item Name</p>
                        <p className="text-lg font-medium text-gray-900">
                          {transaction.request.name}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-600">Category</p>
                      <p className="text-lg font-medium text-gray-900">
                        {transaction.request.category || "—"}
                      </p>
                    </div>
                    {transaction.request.specifications && (
                      <div>
                        <p className="text-sm text-gray-600">Specifications</p>
                        <p className="text-sm text-gray-900 line-clamp-2">
                          {transaction.request.specifications}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : transaction.type === "managed_service" && transaction.service ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">
                    Service Details
                  </h3>
                  <div className="space-y-4">
                    {transaction.service.itemName && (
                      <div>
                        <p className="text-sm text-gray-600">Item Name</p>
                        <p className="text-lg font-medium text-gray-900">
                          {transaction.service.itemName}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-600">Category</p>
                      <p className="text-lg font-medium text-gray-900">
                        {transaction.service.category || "—"}
                      </p>
                    </div>
                    {transaction.service.quantity && (
                      <div>
                        <p className="text-sm text-gray-600">Quantity</p>
                        <p className="text-sm text-gray-900">
                          {transaction.service.quantity}
                        </p>
                      </div>
                    )}
                    {transaction.service.deliveryLocation && (
                      <div>
                        <p className="text-sm text-gray-600">Delivery Location</p>
                        <p className="text-sm text-gray-900">
                          {transaction.service.deliveryLocation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : transaction.type === "managed_service_savings_fee" && transaction.service ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">
                    Savings Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600">Category</p>
                      <p className="text-lg font-medium text-gray-900">
                        {transaction.service.category || "—"}
                      </p>
                    </div>
                    {transaction.service.savingsAmount !== undefined && (
                      <div>
                        <p className="text-sm text-gray-600">Total Savings</p>
                        <p className="text-lg font-medium text-green-600">
                          {formatCurrency(transaction.service.savingsAmount)}
                        </p>
                      </div>
                    )}
                    {transaction.service.savingsFeePercentage !== undefined && (
                      <div>
                        <p className="text-sm text-gray-600">Fee Percentage</p>
                        <p className="text-sm text-gray-900">
                          {transaction.service.savingsFeePercentage}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : transaction.type === "top_up" ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">
                    Top-up Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600">Credits Purchased</p>
                      <p className="text-lg font-medium text-gray-900">
                        {transaction.credits || 0} credit{transaction.credits && transaction.credits > 1 ? "s" : ""}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Price per Credit</p>
                      <p className="text-sm text-gray-900">$10.00</p>
                    </div>
                  </div>
                </div>
              ) : transaction.type === "subscription" ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">
                    Subscription Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600">Plan</p>
                      <p className="text-lg font-medium text-gray-900">
                        {transaction.subscription?.plan || transaction.planType || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Billing Period</p>
                      <p className="text-lg font-medium text-gray-900 capitalize">
                        {transaction.subscription?.period || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Credits Added</p>
                      <p className="text-lg font-medium text-gray-900">
                        {transaction.subscription?.credits ?? 0} credit{(transaction.subscription?.credits ?? 0) === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Uploaded Documents - for Managed Services */}
            {transaction.type === "managed_service" &&
              transaction.service?.finalReport?.supplierDetails?.length > 0 && (
                <div className="mb-8 border-t border-gray-200 pt-8">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-6">
                    Final Report - Supplier Details
                  </h3>
                  <div className="space-y-8">
                    {transaction.service?.finalReport?.supplierDetails?.map(
                      (supplier: any, idx: number) => (
                        <div
                          key={idx}
                          className="border border-gray-200 rounded-lg p-6 bg-gray-50"
                        >
                          <h4 className="font-semibold text-gray-900 mb-4">
                            {supplier.supplierName || "Supplier"}
                          </h4>

                          {/* Supplier Info Grid */}
                          <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200">
                            {supplier.location && (
                              <div>
                                <p className="text-xs text-gray-600 uppercase">Location</p>
                                <p className="text-sm text-gray-900">{supplier.location}</p>
                              </div>
                            )}
                            {supplier.quoteAmount && (
                              <div>
                                <p className="text-xs text-gray-600 uppercase">Quote Amount</p>
                                <p className="text-sm text-gray-900">
                                  {formatCurrency(supplier.quoteAmount)}
                                </p>
                              </div>
                            )}
                            {supplier.leadTime && (
                              <div>
                                <p className="text-xs text-gray-600 uppercase">Lead Time</p>
                                <p className="text-sm text-gray-900">{supplier.leadTime}</p>
                              </div>
                            )}
                            {supplier.minimumOrderQuantity && (
                              <div>
                                <p className="text-xs text-gray-600 uppercase">MOQ</p>
                                <p className="text-sm text-gray-900">
                                  {supplier.minimumOrderQuantity}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Uploaded Documents */}
                          {supplier.uploadedDocuments &&
                            supplier.uploadedDocuments.length > 0 && (
                              <div>
                                <p className="text-sm font-semibold text-gray-700 mb-3">
                                  Documents & Images
                                </p>
                                <div className="space-y-2">
                                  {supplier.uploadedDocuments.map(
                                    (doc: UploadedDocument, docIdx: number) => (
                                      <div
                                        key={docIdx}
                                        className="flex items-center justify-between bg-white p-3 rounded border border-gray-200 hover:shadow-sm transition"
                                      >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                          {getFileTypeIcon(doc)}
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                              {doc.name || doc.fileName}
                                            </p>
                                            {doc.name && (
                                              <p className="text-xs text-gray-500 truncate">
                                                {doc.fileName}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                          <button
                                            onClick={() => openDocument(doc)}
                                            className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded"
                                          >
                                            Preview
                                          </button>
                                          <button
                                            onClick={() => downloadDocument(doc)}
                                            className="px-3 py-1 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded"
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

            {/* Stripe Receipt */}
            {transaction.stripe?.receiptUrl && (
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">
                  Payment Receipt
                </h3>
                <a
                  href={transaction.stripe.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                  View Stripe Receipt
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Preview Modal */}
        {previewModal.isOpen && previewModal.doc && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {previewModal.doc.name || previewModal.doc.fileName}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{previewModal.doc.type}</p>
                </div>
                <button
                  onClick={() => setPreviewModal({ isOpen: false, doc: null })}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-gray-50">
                {previewModal.doc.type === "application/pdf" ? (
                  <iframe
                    src={getFullImageUrl(previewModal.doc.url)}
                    className="w-full h-full rounded"
                    title="PDF Preview"
                  />
                ) : (
                  <img
                    src={getFullImageUrl(previewModal.doc.url)}
                    alt={previewModal.doc.fileName}
                    className="max-w-full max-h-full rounded"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </>
  );
}
