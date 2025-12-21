import { authenticatedRequest } from "@/lib/requestMethod";

// Types
export interface Request {
  id: string;
  requestId?: string; // Backend sometimes returns requestId
  category: string;
  description: string;
  status: string;
  matchedCount?: number;
  matchScore?: number;
  matchReportStatus?: string | null; // 'pending', 'completed', 'unlocked', or null
  createdAt: string;
  updatedAt: string;
}

export interface RequestDetails extends Request {
  name?: string;
  quantity?: number;
  unitPrice?: number;
  totalAmount?: number;
  timeline?: string;
  location?: string;
  requirements?: string;
  matchedCount?: number;
  matchScore?: number;
}

export interface SubscriptionStatus {
  subscriptionStatus: "active" | "expired" | "none";
  subscriptionExpiresAt?: string;
  planType?: string;
  matchCredits?: number;
}

export interface RequestsResponse {
  success: boolean;
  data: {
    requests: Request[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    total?: number; // Keep for backward compatibility if backend not updated fully
    subscriptionPlan?: string;
    subscriptionStatus?: string;
  };
}

export interface Supplier {
  _id?: string;
  name: string;
  location: string;
  email: string;
  phone?: string;
  website?: string;
  description?: string;
  matchScore?: number;
  ranking?: number;
  aiExplanation?: string;
  strengths?: string[];
  leadTime?: string;
  minOrderQuantity?: string;
}

export interface RequestDetailsResponse {
  success: boolean;
  data: {
    request: RequestDetails;
    suppliers: Supplier[];
    isLocked?: boolean;
    status?: string;
    matchReportStatus?: string;
    generatedAt?: string;
  };
}

export interface SubscriptionResponse {
  success: boolean;
  data: SubscriptionStatus;
}

// API Functions

/**
 * Get all requests for the current user
 */
export const getRequests = async (params?: { page?: number; limit?: number }): Promise<RequestsResponse> => {
  const response = await authenticatedRequest.get<RequestsResponse>(
    "/api/dashboard/requests",
    { params }
  );
  return response.data;
};

/**
 * Get request details by ID
 */
export const getRequestDetails = async (
  id: string
): Promise<RequestDetailsResponse> => {
  const response = await authenticatedRequest.get<RequestDetailsResponse>(
    `/api/requests/${id}/details`
  );
  return response.data;
};

/**
 * Get subscription status
 */
export const getSubscriptionStatus = async (): Promise<SubscriptionResponse> => {
  const response = await authenticatedRequest.get<SubscriptionResponse>(
    "/api/dashboard/subscription"
  );
  return response.data;
};

/**
 * Update subscription plan
 */
export interface UpdateSubscriptionData {
  planType: "one-time" | "monthly" | "annual" | "enterprise";
}

export interface UpdateSubscriptionResponse {
  success: boolean;
  message: string;
  data: SubscriptionStatus;
}

export const updateSubscription = async (
  data: UpdateSubscriptionData
): Promise<UpdateSubscriptionResponse> => {
  const response = await authenticatedRequest.post<UpdateSubscriptionResponse>(
    "/api/dashboard/subscription/update",
    data
  );
  return response.data;
};

/**
 * Unlock request using credit
 */
export const unlockRequest = async (id: string): Promise<{ success: boolean; message: string }> => {
  const response = await authenticatedRequest.post<{ success: boolean; message: string }>(
    `/api/requests/${id}/unlock`
  );
  return response.data;
};

/**
 * Credit Transaction types
 */
export interface CreditTransaction {
  id: string;
  requestId?: string | null;
  requestName?: string | null;
  requestCategory?: string | null;
  matchReportId?: string | null;
  creditsUsed: number;
  creditsBefore: number;
  creditsAfter: number;
  transactionType: "deducted" | "added" | "expired";
  reason:
    | "match_generation"
    | "unlock_request"
    | "subscription_allocation"
    | "top_up"
    | "rollover";
  notes?: string;
  createdAt: string;
}

export interface CreditTransactionsResponse {
  success: boolean;
  data: {
    transactions: CreditTransaction[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Get credit transactions for the current user
 */
export const getCreditTransactions = async (params?: {
  page?: number;
  limit?: number;
}): Promise<CreditTransactionsResponse> => {
  const response = await authenticatedRequest.get<CreditTransactionsResponse>(
    "/api/dashboard/credit-transactions",
    { params }
  );
  return response.data;
};
