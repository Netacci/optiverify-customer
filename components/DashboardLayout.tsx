"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  getSubscriptionStatus,
  getCurrentUser,
  logout,
  getFeedback,
} from "@/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const sidebarItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
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
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    href: "/managed-services",
    label: "Managed Sourcing",
    icon: (
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
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    ),
  },
  {
    href: "/requests",
    label: "Requests",
    icon: (
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
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    href: "/billing",
    label: "Billing",
    icon: (
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
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
        />
      </svg>
    ),
  },
  {
    href: "/transactions",
    label: "Transactions",
    icon: (
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
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
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
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
  {
    href: "/feedback",
    label: "Feedback",
    icon: (
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
          d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ),
  },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: subscriptionData } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => getSubscriptionStatus(),
  });

  const { data: userData } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => getCurrentUser(),
  });

  // Fetch feedback to count unread admin replies
  const { data: feedbackData } = useQuery({
    queryKey: ["feedbackForCount"],
    queryFn: () => getFeedback({ page: 1, limit: 100 }), // Get enough to count
    refetchInterval: 30000, // Refetch every 30 seconds to keep count updated
  });

  const subscriptionStatus = subscriptionData?.data;
  const user = userData?.data?.user;

  // Count feedback items with unread admin replies (last reply is from admin and status is "replied")
  const unreadAdminRepliesCount = useMemo(() => {
    if (!feedbackData?.data?.feedback) return 0;
    return feedbackData.data.feedback.filter((feedback) => {
      // Only count feedback with status "replied" (exclude "resolved")
      if (feedback.status !== "replied") return false;
      const replies = feedback.replies || [];
      if (replies.length === 0) return false;
      const lastReply = replies[replies.length - 1];
      // Count if last reply is from admin (meaning admin replied and user hasn't replied yet)
      return lastReply.sender === "admin";
    }).length;
  }, [feedbackData]);

  const handleLogout = async () => {
    await logout();
    // Clear all React Query cache
    queryClient.clear();
    router.push("/login");
  };

  const isSubscriptionExpired = useMemo(() => {
    if (!subscriptionStatus) return false;
    if (subscriptionStatus.subscriptionStatus === "expired") return true;
    if (subscriptionStatus.subscriptionExpiresAt) {
      return new Date(subscriptionStatus.subscriptionExpiresAt) < new Date();
    }
    return false;
  }, [subscriptionStatus]);

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ backgroundColor: "#f9fafb" }}
    >
      {/* Topbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <Link
                href="/dashboard"
                className="ml-4 lg:ml-0 flex items-center gap-2"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">SA</span>
                </div>
                <span className="text-xl font-bold text-gray-900">
                  SupplierMatch<span className="text-blue-600">AI</span>
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/submit-request"
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md text-sm sm:text-base"
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="hidden sm:inline">Submit Request</span>
                <span className="sm:hidden">Submit</span>
              </Link>
              <div className="hidden sm:flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.email?.charAt(0).toUpperCase() || "U"}
                  </span>
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Subscription Expiry Banner */}
      {isSubscriptionExpired && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-b border-yellow-200 px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-600"
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
              <p className="text-sm font-medium text-yellow-800">
                Your subscription has expired. Please renew to continue
                submitting requests.
              </p>
            </div>
            <Link
              href="/dashboard/payment-plans"
              className="text-sm font-semibold text-yellow-800 hover:text-yellow-900 px-4 py-2 bg-yellow-100 hover:bg-yellow-200 rounded-lg transition-colors"
            >
              Renew Now →
            </Link>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 fixed lg:static inset-y-0 lg:inset-auto left-0 z-30 lg:z-auto w-64 flex-shrink-0 bg-white border-r border-gray-200 shadow-sm transition-transform duration-300 ease-in-out`}
          style={{
            top: "64px",
            height: "calc(100vh - 64px)",
          }}
        >
          <div className="h-full flex flex-col pt-6">
            <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
              {sidebarItems.map((item) => {
                // Check if current path matches (including sub-routes for requests)
                const isActive =
                  pathname === item.href ||
                  (item.href === "/requests" &&
                    pathname.startsWith("/requests")) ||
                  (item.href === "/managed-services" &&
                    pathname.startsWith("/managed-services")) ||
                  (item.href === "/transactions" &&
                    pathname.startsWith("/transactions")) ||
                  (item.href === "/feedback" &&
                    pathname.startsWith("/feedback"));

                // Show badge for feedback if there are unread admin replies
                const showBadge =
                  item.href === "/feedback" && unreadAdminRepliesCount > 0;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-sm"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`${
                          isActive ? "text-blue-600" : "text-gray-500"
                        }`}
                      >
                        {item.icon}
                      </span>
                      {item.label}
                    </div>
                    {showBadge && (
                      <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-red-500 text-white">
                        {unreadAdminRepliesCount > 99
                          ? "99+"
                          : unreadAdminRepliesCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed",
              top: "64px",
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              zIndex: 20,
            }}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0 relative z-10 bg-gray-50">
          <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
