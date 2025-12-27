import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getManagedServices, deleteManagedService, ManagedService } from "@/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import Head from "next/head";
import toast from "react-hot-toast";
import { AxiosError } from "axios";

export default function ManagedServicesListPage() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    id: string | null;
    category: string;
  }>({ show: false, id: null, category: "" });

  const { data: servicesData, isLoading, error } = useQuery({
    queryKey: ["managedServices", page],
    queryFn: () => getManagedServices({ page, limit }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteManagedService(id),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || "Request deleted successfully");
        queryClient.invalidateQueries({
          queryKey: ["managedServices"],
        });
      } else {
        toast.error(data.message || "Failed to delete request");
      }
    },
    onError: (error: unknown) => {
      const err = error as AxiosError<{ message: string }>;
      toast.error(err?.response?.data?.message || "Failed to delete request");
    },
  });

  const handleDeleteClick = (id: string, category: string) => {
    setDeleteConfirm({ show: true, id, category });
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirm.id) {
      deleteMutation.mutate(deleteConfirm.id, {
        onSuccess: () => {
          setDeleteConfirm({ show: false, id: null, category: "" });
        },
      });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ show: false, id: null, category: "" });
  };

  // Handle response structure: backend returns { success: true, data: { requests: [], pagination: ... } } OR { success: true, data: [...] }
  // We need to support both for now until backend is confirmed
  const responseData = servicesData?.data;
  let requests: ManagedService[] = [];
  let pagination = { page: 1, limit, total: 0, pages: 1 };

  if (Array.isArray(responseData)) {
    requests = responseData;
    pagination.total = requests.length;
  } else if (responseData && typeof responseData === 'object' && 'requests' in responseData) {
    requests = responseData.requests;
    if (responseData.pagination) {
      pagination = { ...pagination, ...responseData.pagination };
      // Ensure totalPages (pages) is mapped correctly if backend calls it pages
      if (responseData.pagination.pages) {
        pagination.pages = responseData.pagination.pages;
      }
    }
  } else if (Array.isArray(servicesData)) {
     // Fallback if structure is flat array
     requests = servicesData;
     pagination.total = requests.length;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending_payment":
        return "bg-yellow-100 text-yellow-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "action_required":
        return "bg-orange-100 text-orange-800";
      case "completed":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      payment_pending: "Payment Pending",
      review: "Under Review",
      rfq_prep: "Preparing RFQ",
      supplier_outreach: "Supplier Outreach",
      collecting_quotes: "Collecting Quotes",
      negotiating: "Negotiating Prices",
      report_ready: "Report Ready",
      final_report: "Completed",
    };
    return labels[stage] || stage;
  };

  return (
    <>
      <Head>
        <title>Managed Services - Optiverifi</title>
      </Head>
      <DashboardLayout>
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Managed Sourcing Projects
              </h1>
              <p className="text-gray-600">
                Track your expert-managed sourcing requests.
              </p>
            </div>
            <Link
              href="/managed-services/new"
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Start New Project
            </Link>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No managed projects yet
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Start a managed sourcing project and let our experts handle the
                negotiation and verification for you.
              </p>
              <Link
                href="/managed-services/new"
                className="inline-flex bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                Start Your First Project
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Specifications
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Urgency / Days Left
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {requests.map((request: ManagedService) => (
                      <tr key={request._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {request.category}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-md truncate">
                            {request.specifications}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${getStatusColor(
                              request.status
                            )}`}
                          >
                            {request.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {getStageLabel(request.stage)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            {request.urgency && (
                              <span className="text-xs font-medium text-gray-900 capitalize">
                                {request.urgency}
                                {request.urgencyDuration && (
                                  <span className="text-gray-500 ml-1">
                                    ({request.urgencyDuration})
                                  </span>
                                )}
                              </span>
                            )}
                            {request.daysLeft !== undefined && (
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded w-fit ${
                                  request.isOverdue
                                    ? "bg-red-100 text-red-800 font-semibold"
                                    : request.daysLeft <= 2
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {request.isOverdue
                                  ? `Overdue by ${Math.abs(request.daysLeft)} days`
                                  : `${request.daysLeft} days left`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-3 min-w-[140px]">
                            <Link
                              href={`/managed-services/${request._id}`}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              View Details
                            </Link>
                            {request.stage === "payment_pending" ? (
                              <button
                                onClick={() =>
                                  handleDeleteClick(request._id, request.category)
                                }
                                disabled={deleteMutation.isPending && deleteConfirm.id === request._id}
                                className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                title="Delete request"
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
                              <span className="w-[60px]"></span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={page}
                totalPages={pagination.pages}
                onPageChange={setPage}
                totalItems={pagination.total}
                limit={limit}
              />
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {deleteConfirm.show && (
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
                    Are you sure you want to delete the request for{" "}
                    <strong>"{deleteConfirm.category}"</strong>? This action
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

