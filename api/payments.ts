import { authenticatedRequest } from "@/lib/requestMethod";

// Types
export interface CheckoutRequest {
  requestId: string;
  planType:
    | "one-time"
    | "monthly"
    | "annual"
    | "enterprise"
    | "free"
    | "extra_credit"
    | "starter_monthly"
    | "starter_annual"
    | "professional_monthly"
    | "professional_annual";
  email: string;
  quantity?: number; // Optional quantity for extra_credit payments
}

export interface CheckoutResponse {
  success: boolean;
  message: string;
  data: {
    sessionId: string;
    url: string;
    requestId: string;
    planType: string;
  };
}

export interface Payment {
  _id: string;
  requestId?: string;
  matchReportId?: string;
  email: string;
  stripePaymentIntentId?: string;
  stripeSessionId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  amount: number;
  currency: string;
  planType:
    | "one-time"
    | "starter_monthly"
    | "starter_annual"
    | "professional_monthly"
    | "professional_annual"
    | "enterprise"
    | "managed_service"
    | "managed_service_savings_fee"
    | "extra_credit";
  status: "pending" | "succeeded" | "failed" | "canceled";
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncPaymentStatusResponse {
  success: boolean;
  message: string;
  data?: Payment;
}

// API Functions

/**
 * Create Stripe checkout session
 */
export const createCheckoutSession = async (
  data: CheckoutRequest
): Promise<CheckoutResponse> => {
  const response = await authenticatedRequest.post<CheckoutResponse>(
    "/api/payments/checkout",
    data
  );
  return response.data;
};

/**
 * Sync payment status for a request (if webhook failed)
 */
export const syncPaymentStatus = async (
  requestId: string
): Promise<SyncPaymentStatusResponse> => {
  const response = await authenticatedRequest.post<SyncPaymentStatusResponse>(
    `/api/payments/${requestId}/sync`
  );
  return response.data;
};

/**
 * Sync all payments and subscriptions for the current user
 */
export const syncUserPayments = async (): Promise<{
  success: boolean;
  message: string;
  data?: { syncedCount: number; subscriptionUpdated: boolean };
}> => {
  const response = await authenticatedRequest.post<{
    success: boolean;
    message: string;
    data?: { syncedCount: number; subscriptionUpdated: boolean };
  }>("/api/payments/sync");
  return response.data;
};
