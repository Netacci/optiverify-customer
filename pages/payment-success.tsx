import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import {
  syncUserPayments,
  getLatestSubscriptionPayment,
  getSubscriptionStatus,
} from "@/api";
import DashboardLayout from "@/components/DashboardLayout";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hasProcessed = useRef(false);
  const [processing, setProcessing] = useState(true);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const { data: subscriptionData } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => getSubscriptionStatus(),
    refetchOnMount: "always",
    staleTime: 0,
  });

  useEffect(() => {
    if (!router.isReady || hasProcessed.current) return;
    hasProcessed.current = true;

    (async () => {
      // 1. Verify/activate the payment. This is the fallback for when the Stripe
      //    webhook hasn't reached the server (e.g. local dev). It's a no-op if the
      //    webhook already activated it.
      try {
        const sync = await syncUserPayments();
        if (sync?.data?.subscriptionPaymentId) {
          setTransactionId(sync.data.subscriptionPaymentId);
        }
      } catch (err) {
        console.error("Renewal sync failed:", err);
      }

      // 2. Resolve the transaction id authoritatively (covers the webhook-activated
      //    case, where sync finds nothing pending and returns no id).
      try {
        const latest = await getLatestSubscriptionPayment();
        if (latest?.data?.id) setTransactionId(latest.data.id);
      } catch (err) {
        console.error("Could not resolve subscription transaction:", err);
      }

      // 3. Refresh subscription status, credits, and transaction history.
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      queryClient.invalidateQueries({ queryKey: ["creditTransactions"] });

      setProcessing(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  const sub = subscriptionData?.data;
  const isActive = sub?.subscriptionStatus === "active";
  const credits = sub?.matchCredits;

  return (
    <>
      <Head>
        <title>Payment Successful - Optiverifi</title>
      </Head>
      <DashboardLayout>
        <div className="max-w-xl mx-auto py-10">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            {processing ? (
              <div className="flex flex-col items-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
                <p className="text-gray-600 font-medium">
                  Confirming your payment...
                </p>
              </div>
            ) : isActive ? (
              <>
                {/* Success icon */}
                <div className="mx-auto mb-5 flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                  <svg
                    className="w-9 h-9 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Your plan is active
                </h1>
                <p className="text-gray-600 mb-6">
                  Your subscription has been renewed
                  {typeof credits === "number"
                    ? ` and ${credits} credit${credits === 1 ? "" : "s"} ${
                        credits === 1 ? "is" : "are"
                      } available on your account.`
                    : "."}
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {transactionId && (
                    <Link
                      href={`/transaction/${transactionId}`}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                    >
                      See transaction
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
                          d="M17 8l4 4m0 0l-4 4m4-4H3"
                        />
                      </svg>
                    </Link>
                  )}
                  <Link
                    href="/billing"
                    className="inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-800 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                  >
                    Back to billing
                  </Link>
                </div>
              </>
            ) : (
              <>
                {/* Pending / could not confirm yet */}
                <div className="mx-auto mb-5 flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full">
                  <svg
                    className="w-9 h-9 text-yellow-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8v4m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                    />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  We&apos;re confirming your payment
                </h1>
                <p className="text-gray-600 mb-6">
                  This can take a moment. Your plan will activate automatically
                  once payment is confirmed.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => router.reload()}
                    className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Refresh
                  </button>
                  <Link
                    href="/billing"
                    className="inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-800 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                  >
                    Back to billing
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}
