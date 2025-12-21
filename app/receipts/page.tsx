"use client";

import { useQuery } from "@tanstack/react-query";
import { getAllReceipts } from "@/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";

export default function ReceiptsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["receipts"],
    queryFn: () => getAllReceipts(),
  });

  const receipts = data?.data?.transactions || [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number, currency: string = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Receipts</h1>
          <p className="text-gray-600">View all your payment receipts and invoices</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
          </div>
        ) : receipts.length === 0 ? (
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No receipts found</h3>
            <p className="text-gray-600">You haven&apos;t made any payments yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {receipts.map((receipt) => (
              <Link
                key={receipt.id}
                href={
                  receipt.type === "match_report"
                    ? `/receipts/payment/${receipt.id}`
                    : `/receipts/managed-service/${receipt.id}`
                }
                className="block bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow p-6"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          receipt.type === "match_report"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {receipt.type === "match_report" ? "Match Report" : "Managed Service"}
                      </span>
                      {receipt.planType && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {receipt.planType}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {receipt.type === "match_report"
                        ? receipt.request?.category || "Match Report"
                        : receipt.service?.category || "Managed Service"}
                    </h3>
                    {receipt.type === "match_report" && receipt.request?.specifications && (
                      <p className="text-sm text-gray-600 line-clamp-1 mb-2">
                        {receipt.request.specifications}
                      </p>
                    )}
                    <p className="text-sm text-gray-500">
                      Paid on {formatDate(receipt.paidAt)}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-2xl font-bold text-gray-900 mb-1">
                      {formatCurrency(receipt.amount, receipt.currency)}
                    </p>
                    <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                      <span>View Receipt</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

