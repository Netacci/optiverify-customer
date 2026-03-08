import { useQuery } from "@tanstack/react-query";
import {
  getRequests,
  getManagedServices,
  Request,
  ManagedService,
} from "@/api";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import Head from "next/head";

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["userRequests"],
    queryFn: () => getRequests(),
  });

  const { data: managedServicesData, isLoading: isLoadingManagedServices } =
    useQuery({
      queryKey: ["managedServices"],
      queryFn: () => getManagedServices(),
    });

  // Backend returns { data: { requests: [], total, subscriptionPlan, subscriptionStatus } }
  const requests = Array.isArray(data?.data?.requests)
    ? data.data.requests
    : [];
  const totalRequests = requests.length;
  const unlockedRequests = requests.filter(
    (r: Request) => r.status === "unlocked" || r.status === "completed"
  ).length;
  const totalSuppliers = requests.reduce(
    (sum: number, r: Request) => sum + (r.matchedCount || 0),
    0
  );

  // Managed Services Analytics
  const managedServices = Array.isArray(managedServicesData?.data)
    ? managedServicesData.data
    : Array.isArray(managedServicesData?.data?.requests)
    ? managedServicesData.data.requests
    : [];
  const totalManagedServices = managedServices.length;
  const activeManagedServices = managedServices.filter(
    (s: ManagedService) => s.status === "in_progress"
  ).length;

  return (
    <>
      <Head>
        <title>Dashboard - Optiverifi</title>
      </Head>
      <DashboardLayout>
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              Overview of your supplier matching activity
            </p>
          </div>

          {isLoading || isLoadingManagedServices ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-500 text-sm">Loading...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center gap-3">
              <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-600 text-sm font-medium">Failed to load data</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Key Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-sm text-gray-500">Total Requests</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{totalRequests}</p>
                  <p className="text-xs text-gray-400 mt-1">Supplier matching</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-sm text-gray-500">Unlocked Matches</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{unlockedRequests}</p>
                  <p className="text-xs text-gray-400 mt-1">{totalSuppliers} suppliers found</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-sm text-gray-500">Managed Services</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{totalManagedServices}</p>
                  <p className="text-xs text-gray-400 mt-1">Total submitted</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-sm text-gray-500">Active Services</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{activeManagedServices}</p>
                  <p className="text-xs text-gray-400 mt-1">Currently in progress</p>
                </div>
              </div>

              {/* Service Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="font-semibold text-gray-900">Supplier Matching</h2>
                  <p className="text-sm text-gray-500 mt-1 mb-5">
                    Submit a procurement request and get matched with verified suppliers.
                  </p>
                  <div className="flex gap-2">
                    <Link
                      href="/submit-request"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      New Request
                    </Link>
                    <Link
                      href="/requests"
                      className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      View Requests
                    </Link>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="font-semibold text-gray-900">Managed Sourcing</h2>
                  <p className="text-sm text-gray-500 mt-1 mb-5">
                    Let our team handle end-to-end procurement on your behalf.
                  </p>
                  <div className="flex gap-2">
                    <Link
                      href="/managed-services/new"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      New Request
                    </Link>
                    <Link
                      href="/managed-services"
                      className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      View Services
                    </Link>
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

