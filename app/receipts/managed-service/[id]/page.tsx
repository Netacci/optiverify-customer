"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { getManagedServiceReceipt } from "@/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";

export const dynamic = 'force-static';
export const dynamicParams = true;

export default function ManagedServiceReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  
  const { data, isLoading } = useQuery({
    queryKey: ["receipt", "managed-service", id],
    queryFn: () => getManagedServiceReceipt(id),
  });

  const receipt = data?.data;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
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

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!receipt) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold text-gray-900">Receipt not found</h2>
          <Link href="/receipts" className="text-blue-600 hover:underline mt-4 inline-block">
            Back to Receipts
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <Link
          href="/receipts"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 group"
        >
          <svg
            className="w-5 h-5 group-hover:-translate-x-1 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">Back to Receipts</span>
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-8 py-6 text-white">
            <h1 className="text-3xl font-bold mb-2">Service Fee Receipt</h1>
            <p className="text-purple-100">Receipt #{receipt.id.slice(-8).toUpperCase()}</p>
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Payment Date</h3>
                <p className="text-gray-900 font-medium">{formatDate(receipt.paidAt)}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Service Type</h3>
                <p className="text-gray-900 font-medium">Managed Sourcing Service</p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Details</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-gray-500">Category</dt>
                  <dd className="text-gray-900 font-medium">{receipt.service?.category}</dd>
                </div>
                {receipt.service?.specifications && (
                  <div>
                    <dt className="text-sm text-gray-500">Specifications</dt>
                    <dd className="text-gray-900">{receipt.service.specifications}</dd>
                  </div>
                )}
                {receipt.service?.quantity && (
                  <div>
                    <dt className="text-sm text-gray-500">Quantity</dt>
                    <dd className="text-gray-900">{receipt.service.quantity}</dd>
                  </div>
                )}
                {receipt.service?.deliveryLocation && (
                  <div>
                    <dt className="text-sm text-gray-500">Delivery Location</dt>
                    <dd className="text-gray-900">{receipt.service.deliveryLocation}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="border-t border-gray-200 pt-6 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Service Fee</span>
                <span className="text-3xl font-bold text-gray-900">
                  {formatCurrency(receipt.amount, receipt.currency)}
                </span>
              </div>
            </div>

            {receipt.stripe?.receiptUrl && (
              <div className="border-t border-gray-200 pt-6">
                <a
                  href={receipt.stripe.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  View Stripe Receipt
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

