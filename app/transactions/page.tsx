"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllReceipts, Receipt } from "@/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import Pagination from "@/components/Pagination";

export const dynamic = "force-static";

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["receipts", page],
    queryFn: () => getAllReceipts({ page, limit }),
  });

  const transactions = data?.data?.transactions || [];
  const pagination = data?.data?.pagination || {
    page: 1,
    limit,
    total: 0,
    totalPages: 1,
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

  const getTypeBadge = (type: string) => {
    if (type === "match_report") {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
          Match Report
        </span>
      );
    }
    if (type === "managed_service_savings_fee") {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
          Savings Fee
        </span>
      );
    }
    if (type === "top_up") {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
          Top-up
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
        Managed Service
      </span>
    );
  };

  const getDescription = (transaction: Receipt) => {
    if (transaction.type === "match_report") {
      return transaction.request?.category || "Match Report";
    }
    if (transaction.type === "managed_service_savings_fee") {
      return `Savings Fee - ${
        transaction.service?.category || "Managed Service"
      }`;
    }
    if (transaction.type === "top_up") {
      return `Top-up - ${transaction.credits} credit${
        transaction.credits && transaction.credits > 1 ? "s" : ""
      }`;
    }
    return transaction.service?.category || "Managed Service";
  };

  const getReceiptLink = (transaction: Receipt) => {
    if (transaction.type === "match_report") {
      return `/receipts/payment/${transaction.id}`;
    }
    if (transaction.type === "managed_service_savings_fee") {
      return `/receipts/managed-service/${transaction.service?.id}/savings-fee`;
    }
    return `/receipts/managed-service/${transaction.service?.id}`;
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Transactions
          </h1>
          <p className="text-gray-600">
            View all your payment transactions and receipts
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
          </div>
        ) : transactions.length === 0 ? (
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No transactions found
            </h3>
            <p className="text-gray-600">
              You haven&apos;t made any payments yet.
            </p>
          </div>
        ) : (
          <>
            {/* Transactions Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transactions.map((transaction: Receipt) => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(transaction.paidAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getTypeBadge(transaction.type)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div>
                            <p className="font-medium">
                              {getDescription(transaction)}
                            </p>
                            {transaction.planType && (
                              <p className="text-gray-500 text-xs mt-1 capitalize">
                                {transaction.planType.replace(/_/g, " ")}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {formatCurrency(
                            transaction.amount,
                            transaction.currency
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={getReceiptLink(transaction)}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            View Receipt
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <Pagination
                currentPage={page}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
                totalItems={pagination.total}
                limit={limit}
              />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
