"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  createRequest,
  submitForMatching,
  getSubscriptionStatus,
  getCurrentUser,
  getCategories,
} from "@/api";
import DashboardLayout from "@/components/DashboardLayout";
import axios from "axios";

export default function SubmitRequestPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    unitPrice: "",
    quantity: "",
    description: "",
    timeline: "",
    location: "",
    requirements: "",
    email: "",
  });

  // Calculate total amount
  const calculateTotal = () => {
    const unitPriceNum =
      parseFloat(String(formData.unitPrice).replace(/[$,]/g, "")) || 0;
    if (formData.quantity) {
      const quantityMatch = String(formData.quantity).match(
        /(\d+(?:[.,]\d+)?)/
      );
      if (quantityMatch) {
        const quantityNum = parseFloat(quantityMatch[1].replace(/,/g, "")) || 0;
        return unitPriceNum * quantityNum;
      }
    }
    return unitPriceNum;
  };

  const totalAmount = calculateTotal();

  const { data: subscriptionData } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => getSubscriptionStatus(),
  });

  const { data: userData } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => getCurrentUser(),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const subscriptionStatus = subscriptionData?.data;
  const user = userData?.data?.user;
  const categories = categoriesData?.data || [];

  const createMutation = useMutation({
    mutationFn: createRequest,
  });

  const matchMutation = useMutation({
    mutationFn: submitForMatching,
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Set email from user
    const submitData = {
      ...formData,
      email: user?.email || "",
      unitPrice: formData.unitPrice.replace(/[$,]/g, ""), // Remove $ and commas
    };

    try {
      toast.loading("Creating your request...", { id: "create-request" });
      const createResponse = await createMutation.mutateAsync(submitData);
      const requestId = createResponse.data.id;

      if (!requestId) {
        toast.error("Failed to get request ID", { id: "create-request" });
        return;
      }

      toast.success("Request created successfully!", { id: "create-request" });

      // Check subscription and credits logic
      const isSubscriptionActive =
        subscriptionStatus?.subscriptionStatus === "active";
      const hasCredits = (subscriptionStatus?.matchCredits || 0) > 0;

      if (!isSubscriptionActive) {
        // No active subscription, redirect to payment page
        toast.success("Request created successfully!", {
          id: "create-request",
        });
        toast("Please choose a plan to process your request", {
          icon: "💳",
          duration: 4000,
        });
        router.push(`/payment-plans?requestId=${requestId}`);
        return;
      }

      // User has active subscription but no credits, redirect to top-up page
      if (isSubscriptionActive && !hasCredits) {
        toast.success("Request created successfully!", {
          id: "create-request",
        });
        toast("You need credits to process your request. Please top up.", {
          icon: "💳",
          duration: 4000,
        });
        router.push(`/payment-plans?requestId=${requestId}&topUp=true`);
        return;
      }

      // User has active subscription and credits, process matching
      toast.loading("Finding matching suppliers...", { id: "matching" });
      try {
        await matchMutation.mutateAsync(String(requestId));
        toast.success("Suppliers matched successfully!", { id: "matching" });
        router.push(`/requests/${requestId}`);
      } catch (matchError: unknown) {
        // Check if payment is required (shouldn't happen if subscription is active, but handle it)
        if (
          axios.isAxiosError(matchError) &&
          matchError.response?.data?.code === "PAYMENT_REQUIRED"
        ) {
          const redirectUrl =
            matchError.response?.data?.redirectUrl ||
            `/payment-plans?requestId=${requestId}`;
          toast.error("Payment required to process matching", {
            id: "matching",
            duration: 3000,
          });
          setTimeout(() => {
            router.push(redirectUrl);
          }, 1500);
          return;
        }

        let errorMessage = "Failed to find matching suppliers";
        if (
          axios.isAxiosError(matchError) &&
          matchError.response?.data?.message
        ) {
          errorMessage = matchError.response.data.message;
        } else if (matchError instanceof Error) {
          errorMessage = matchError.message;
        }
        toast.error(errorMessage, { id: "matching" });
      }
    } catch (error: unknown) {
      let errorMessage = "Failed to submit request";
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage, { id: "create-request" });
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Submit New Request
          </h1>
          <p className="text-gray-600">
            Tell us what you need and we&apos;ll find the perfect suppliers for
            you. Submitting is free.
          </p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
            <span className="font-semibold">Pricing:</span>
            <ul className="list-disc list-inside mt-1 ml-1 space-y-1">
              <li>
                <strong>Basic:</strong> $49 per unlock (One-time).
              </li>
              <li>
                <strong>Starter:</strong> $79/mo for 5 matches/month.{" "}
                <strong>Professional:</strong> $199/mo for 15 matches/month (max
                3 credits rollover).
              </li>
            </ul>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-semibold text-gray-900 mb-2"
                >
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400"
                  placeholder="e.g., Custom Printed T-Shirts"
                />
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="block text-sm font-semibold text-gray-900 mb-2"
                >
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="unitPrice"
                  className="block text-sm font-semibold text-gray-900 mb-2"
                >
                  Unit Price <span className="text-red-500">*</span>
                </label>
                <div className="relative rounded-[8px]">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-gray-500 text-sm">$</span>
                  </div>
                  <input
                    type="text"
                    id="unitPrice"
                    name="unitPrice"
                    value={formData.unitPrice}
                    onChange={handleChange}
                    required
                    className="block w-full px-4 py-3 pl-7 pr-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400"
                    placeholder="e.g., 10.50"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="quantity"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Quantity
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    (Optional)
                  </span>
                </label>
                <input
                  type="text"
                  id="quantity"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400"
                  placeholder="e.g., 1000 units"
                />
                {formData.quantity && totalAmount > 0 && (
                  <p className="mt-2 text-sm text-gray-600">
                    Total Amount:{" "}
                    <span className="font-semibold">
                      $
                      {totalAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="timeline"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Timeline
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    (Optional)
                  </span>
                </label>
                <input
                  type="text"
                  id="timeline"
                  name="timeline"
                  value={formData.timeline}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400"
                  placeholder="e.g., 4-6 weeks"
                />
              </div>

              <div>
                <label
                  htmlFor="location"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Location
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    (Optional)
                  </span>
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400"
                  placeholder="e.g., United States"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Description
                <span className="ml-2 text-xs font-normal text-gray-500">
                  (Optional)
                </span>
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400 resize-none"
                placeholder="Describe what you're looking for..."
              />
            </div>

            <div>
              <label
                htmlFor="requirements"
                className="block text-sm font-semibold text-gray-900 mb-2"
              >
                Requirements
              </label>
              <textarea
                id="requirements"
                name="requirements"
                value={formData.requirements}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400 resize-none"
                placeholder="Any specific requirements, certifications, or standards..."
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={createMutation.isPending || matchMutation.isPending}
                className="flex-1 px-6 py-3.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {createMutation.isPending || matchMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Submit Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
