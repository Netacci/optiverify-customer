import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { AxiosError } from "axios";
import {
  submitFeedback,
  getFeedback,
  replyToFeedback,
  getRequests,
  getManagedServices,
  getAllReceipts,
  Feedback,
  FeedbackReply,
  SubmitFeedbackData,
  Request,
  Receipt,
  ManagedService,
} from "@/api";
import DashboardLayout from "@/components/DashboardLayout";
import SearchableSelect from "@/components/SearchableSelect";
import Pagination from "@/components/Pagination";
import Head from "next/head";

type FeedbackType = "request" | "matching_service" | "general" | "billing";

export default function FeedbackPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [view, setView] = useState<"list" | "new" | "detail">("list");
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(
    null
  );
  const [page, setPage] = useState(1);
  const limit = 10;

  // New Feedback Form State
  const [formData, setFormData] = useState({
    type: "general" as FeedbackType,
    requestId: "",
    matchingServiceId: "",
    transactionId: "",
    subject: "",
    message: "",
    rating: "",
  });

  // Reply State
  const [replyMessage, setReplyMessage] = useState("");

  // Initial Check for Params
  useEffect(() => {
    if (!router.isReady) return;
    
    const type = router.query.type as string;
    const requestId = router.query.requestId as string;
    const matchingServiceId = router.query.matchingServiceId as string;

    if (
      type &&
      (type === "request" ||
        type === "matching_service" ||
        type === "general" ||
        type === "billing")
    ) {
      setFormData((prev) => ({
        ...prev,
        type: type as FeedbackType,
        requestId: requestId || prev.requestId,
        matchingServiceId: matchingServiceId || prev.matchingServiceId,
      }));
      setView("new");
    }
  }, [router.isReady, router.query]);

  // Fetch Feedback List
  const { data: feedbackData, isLoading } = useQuery({
    queryKey: ["feedback", page],
    queryFn: () => getFeedback({ page, limit }),
  });

  const feedbackList = feedbackData?.data?.feedback || [];
  const pagination = feedbackData?.data?.pagination;

  // Fetch Requests for Form
  const { data: requestsData } = useQuery({
    queryKey: ["userRequests"],
    queryFn: () => getRequests(),
    enabled: view === "new" && formData.type === "request",
  });

  // Fetch Managed Services for Form
  const { data: managedServicesData } = useQuery({
    queryKey: ["managedServices"],
    queryFn: () => getManagedServices(),
    enabled: view === "new" && formData.type === "matching_service",
  });

  // Fetch Transactions for Form
  const { data: transactionsData } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => getAllReceipts({ limit: 100 }), // Fetch recent 100 for dropdown
    enabled: view === "new" && formData.type === "billing",
  });

  const requests = useMemo(() => {
    return requestsData?.data?.requests || [];
  }, [requestsData]);

  const managedServices = useMemo(() => {
    const data = managedServicesData?.data;
    return Array.isArray(data)
      ? data
      : Array.isArray(managedServicesData)
      ? managedServicesData
      : [];
  }, [managedServicesData]);

  const transactions = useMemo(() => {
    return transactionsData?.data?.transactions || [];
  }, [transactionsData]);

  // Mutations
  const submitMutation = useMutation({
    mutationFn: submitFeedback,
    onSuccess: () => {
      toast.success("Feedback submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      queryClient.invalidateQueries({ queryKey: ["feedbackForCount"] });
      setFormData({
        type: "general",
        requestId: "",
        matchingServiceId: "",
        transactionId: "",
        subject: "",
        message: "",
        rating: "",
      });
      setView("list");
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(
        error?.response?.data?.message || "Failed to submit feedback"
      );
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      replyToFeedback(id, message),
    onSuccess: (data) => {
      toast.success("Reply sent!");
      setReplyMessage("");
      // Update the selected feedback with the new data
      if (selectedFeedback && data.data) {
        setSelectedFeedback(data.data);
      }
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      queryClient.invalidateQueries({ queryKey: ["feedbackForCount"] });
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error?.response?.data?.message || "Failed to send reply");
    },
  });

  // Helper Functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-100 text-blue-800";
      case "read":
        return "bg-blue-100 text-blue-800"; // User sees "Sent"
      case "replied":
        return "bg-yellow-100 text-yellow-800";
      case "resolved":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === "new" || status === "read") return "Sent";
    if (status === "replied") return "Replied";
    if (status === "resolved") return "Resolved";
    return status;
  };

  // Prepare Options for Dropdowns
  const requestOptions = requests.map((r: Request) => ({
    value: r.requestId || r.id,
    label: `${r.category} - ${new Date(r.createdAt).toLocaleDateString()}`,
  }));

  const matchingServiceOptions = managedServices
    .filter((s: ManagedService) => s._id || s.id)
    .map((s: ManagedService) => ({
      value: (s._id || s.id) as string,
      label: `${s.category} - ${new Date(s.createdAt).toLocaleDateString()}`,
    }));

  const transactionOptions = transactions.map((t: Receipt) => {
    let label = `Transaction #${t.id.slice(-6).toUpperCase()} - $${
      t.amount
    } (${new Date(t.createdAt).toLocaleDateString()})`;
    if (t.request?.category) label += ` - ${t.request.category}`;
    else if (t.service?.category) label += ` - ${t.service.category}`;
    else if (t.planType) label += ` - ${t.planType} Plan`;

    return {
      value: t.id,
      label: label,
    };
  });

  return (
    <>
      <Head>
        <title>Feedback - Optiverifi</title>
      </Head>
      <DashboardLayout>
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Support & Feedback
              </h1>
              <p className="text-gray-600">
                Track your conversations and submit new requests
              </p>
            </div>
            <button
              onClick={() => setView("new")}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
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
              New Feedback
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
            </div>
          ) : feedbackList.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <p className="text-gray-500 mb-4">No feedback history found.</p>
              <button
                onClick={() => setView("new")}
                className="text-blue-600 font-medium hover:underline"
              >
                Start a conversation
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subject
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {feedbackList.map((item: Feedback) => (
                      <tr
                        key={item._id}
                        onClick={() => {
                          setSelectedFeedback(item);
                          setView("detail");
                        }}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">
                            {item.subject}
                          </div>
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {item.message}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                          {item.type.replace("_", " ")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                              item.status
                            )}`}
                          >
                            {getStatusLabel(item.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-blue-600">
                          View
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={page}
                totalPages={pagination?.pages || 1}
                onPageChange={setPage}
                totalItems={pagination?.total || 0}
                limit={limit}
              />
            </div>
          )}

          {/* New Feedback Modal */}
          {view === "new" && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <h2 className="text-xl font-bold text-gray-900">
                    Submit New Feedback
                  </h2>
                  <button
                    onClick={() => setView("list")}
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

                <div className="p-6 overflow-y-auto">
                  {/* Disclaimer */}
                  <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-blue-600 mt-0.5 shrink-0"
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
                    <div>
                      <h3 className="text-sm font-semibold text-blue-900 mb-1">
                        Response Time
                      </h3>
                      <p className="text-sm text-blue-800">
                        We typically respond to feedback within 8 hours. For
                        urgent matters, please check our help center.
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!formData.subject || !formData.message)
                        return toast.error("Please fill required fields");

                      const submitData: SubmitFeedbackData = {
                        type: formData.type,
                        subject: formData.subject,
                        message: formData.message,
                      };

                      if (formData.type === "request")
                        submitData.requestId = formData.requestId;
                      if (formData.type === "matching_service")
                        submitData.matchingServiceId = formData.matchingServiceId;
                      if (formData.type === "billing")
                        submitData.transactionId = formData.transactionId;
                      if (formData.rating)
                        submitData.rating = parseInt(formData.rating);

                      submitMutation.mutate(submitData);
                    }}
                    className="space-y-6"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Feedback Type *
                      </label>
                      <select
                        value={formData.type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            type: e.target.value as FeedbackType,
                            requestId: "",
                            matchingServiceId: "",
                            transactionId: "",
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="general">General</option>
                        <option value="request">Request</option>
                        <option value="matching_service">Matching Service</option>
                        <option value="billing">Billing & Payments</option>
                      </select>
                    </div>

                    {formData.type === "request" && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Select Request *
                        </label>
                        <SearchableSelect
                          id="requestId"
                          name="requestId"
                          value={formData.requestId}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              requestId: e.target.value,
                            })
                          }
                          options={requestOptions}
                          placeholder="Select a request..."
                          required
                        />
                      </div>
                    )}

                    {formData.type === "matching_service" && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Select Service *
                        </label>
                        <SearchableSelect
                          id="matchingServiceId"
                          name="matchingServiceId"
                          value={formData.matchingServiceId}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              matchingServiceId: e.target.value,
                            })
                          }
                          options={matchingServiceOptions}
                          placeholder="Select a service..."
                          required
                        />
                      </div>
                    )}

                    {formData.type === "billing" && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Select Transaction (Optional)
                        </label>
                        <SearchableSelect
                          id="transactionId"
                          name="transactionId"
                          value={formData.transactionId}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              transactionId: e.target.value,
                            })
                          }
                          options={transactionOptions}
                          placeholder="Select a transaction..."
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subject *
                      </label>
                      <input
                        type="text"
                        value={formData.subject}
                        onChange={(e) =>
                          setFormData({ ...formData, subject: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Message *
                      </label>
                      <textarea
                        value={formData.message}
                        onChange={(e) =>
                          setFormData({ ...formData, message: e.target.value })
                        }
                        rows={6}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    {formData.type !== "general" &&
                      formData.type !== "billing" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Rating (1-10)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={formData.rating}
                            onChange={(e) =>
                              setFormData({ ...formData, rating: e.target.value })
                            }
                            className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}

                    <div className="pt-2 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setView("list")}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitMutation.isPending}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {submitMutation.isPending
                          ? "Submitting..."
                          : "Submit Feedback"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Detail Modal */}
          {view === "detail" && selectedFeedback && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <h2 className="text-xl font-bold text-gray-900">
                    Feedback Details
                  </h2>
                  <button
                    onClick={() => {
                      setSelectedFeedback(null);
                      setView("list");
                    }}
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

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Header Info */}
                  <div className="grid grid-cols-2 gap-4 text-sm bg-white p-4 rounded-lg border border-gray-100">
                    <div>
                      <span className="block text-gray-500 mb-1">Subject</span>
                      <span className="font-medium text-gray-900">
                        {selectedFeedback.subject}
                      </span>
                    </div>
                    <div>
                      <span className="block text-gray-500 mb-1">Type</span>
                      <span className="capitalize text-gray-900">
                        {selectedFeedback.type.replace("_", " ")}
                      </span>
                    </div>
                    <div>
                      <span className="block text-gray-500 mb-1">Status</span>
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                          selectedFeedback.status
                        )}`}
                      >
                        {getStatusLabel(selectedFeedback.status)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-gray-500 mb-1">Date</span>
                      <span className="text-gray-900">
                        {new Date(
                          selectedFeedback.createdAt
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Conversation Thread */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900 border-b pb-2">
                      Conversation
                    </h3>

                    {/* Original Message */}
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">You</span>
                        <span className="text-xs text-gray-500">
                          {new Date(selectedFeedback.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg rounded-tl-none text-gray-800">
                        {selectedFeedback.message}
                      </div>
                    </div>

                    {/* Replies */}
                    {selectedFeedback.replies?.map(
                      (reply: FeedbackReply, index: number) => (
                        <div
                          key={index}
                          className={`flex flex-col space-y-2 ${
                            reply.sender === "user" ? "" : "items-end"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {reply.sender === "user" ? "You" : "Support Team"}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(reply.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div
                            className={`p-4 rounded-lg max-w-[80%] ${
                              reply.sender === "user"
                                ? "bg-blue-50 rounded-tl-none text-gray-800"
                                : "bg-gray-100 rounded-tr-none text-gray-800"
                            }`}
                          >
                            {reply.message}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {selectedFeedback.status !== "resolved" ? (
                  <div className="p-6 border-t border-gray-200 bg-gray-50">
                    <div className="flex gap-2">
                      <textarea
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Type your reply..."
                        className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                        rows={3}
                      />
                      <button
                        onClick={() =>
                          replyMutation.mutate({
                            id: selectedFeedback._id,
                            message: replyMessage,
                          })
                        }
                        disabled={!replyMessage.trim() || replyMutation.isPending}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 self-end"
                      >
                        {replyMutation.isPending ? "Sending..." : "Reply"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 border-t border-gray-200 bg-gray-50 text-center text-gray-500 italic">
                    This conversation has been resolved. Please submit new
                    feedback for further inquiries.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  );
}

