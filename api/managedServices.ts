// Managed Services
import { authenticatedRequest } from "@/lib/requestMethod";

export interface UploadedDocument {
  name?: string;
  fileName: string;
  type: string;
  url: string;
}

export interface ManagedServiceRequestData {
  itemName: string;
  category: string;
  subCategory?: string;
  quantity: string;
  description: string;
  estimatedSpendRange: string;
  urgency: string;
  complianceLevel: "commercial" | "government" | "regulated";
  deliveryLocation: string;
  internalDeadline?: string;
  // Legacy fields for backward compatibility
  specifications?: string;
  budget?: string;
  deadline?: string;
}

export const initiateManagedService = async (
  data: ManagedServiceRequestData
) => {
  const response = await authenticatedRequest.post<{
    success: boolean;
    data: { requestId: string; serviceFeeAmount: number };
  }>("/api/managed-services/initiate", data);
  return response.data;
};

export interface ManagedService {
  _id: string;
  id?: string; // Sometimes returned as id or _id
  itemName: string;
  category: string;
  subCategory?: string;
  description: string;
  estimatedSpendRange?: string;
  complianceLevel: "commercial" | "government" | "regulated";
  specifications: string;
  quantity: string;
  deliveryLocation: string;
  internalDeadline?: string;
  budget?: string;
  deadline?: string;
  status: string;
  stage: string;
  urgency?: string;
  urgencyDuration?: string;
  daysLeft?: number;
  isOverdue?: boolean;
  createdAt: string;
  updatedAt: string;
  serviceFeeAmount?: number;
  serviceFeeStatus?: string;
  serviceFeePaymentId?: string;
  email?: string;
  savingsFeePercentage?: number;
  savingsFeeAmount?: number;
  savingsFeeStatus?: string;
  savingsAmount?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  finalReport?: any;
  [key: string]: unknown;
}

export const getManagedServices = async (params?: {
  page?: number;
  limit?: number;
}) => {
  const response = await authenticatedRequest.get<{
    success: boolean;
    data:
      | {
          requests: ManagedService[];
          pagination?: {
            page: number;
            limit: number;
            total: number;
            pages: number;
          };
        }
      | ManagedService[]; // Handle both array and paginated object structure
  }>("/api/managed-services", { params });
  return response.data;
};

export const getManagedServiceDetails = async (id: string) => {
  const response = await authenticatedRequest.get<{
    success: boolean;
    data: ManagedService;
  }>(`/api/managed-services/${id}`);
  return response.data;
};

export const updateManagedService = async (
  id: string,
  data: Partial<ManagedServiceRequestData>
) => {
  const response = await authenticatedRequest.put<{
    success: boolean;
    message: string;
    data: ManagedService;
  }>(`/api/managed-services/${id}`, data);
  return response.data;
};

export const syncManagedServicePayment = async (id: string) => {
  const response = await authenticatedRequest.post<{
    success: boolean;
    message: string;
    data: ManagedService;
  }>(`/api/managed-services/${id}/sync-payment`);
  return response.data;
};

/**
 * Create a Stripe checkout session for the managed-service service fee.
 *
 * The backend derives `amount` from the request record and `email`/`userId`
 * from the authenticated session. We MUST NOT send those from the client —
 * trusting them would let a logged-in user pay $0.01 for a $999 fee or
 * attribute another user's payment to themselves. (Audit finding H-3.)
 */
export const createServiceFeePaymentSession = async (id: string) => {
  const response = await authenticatedRequest.post<{
    success: boolean;
    message: string;
    data: {
      sessionId: string;
      url: string;
      requestId: string;
    };
  }>(`/api/managed-services/payment/create-session`, {
    requestId: id,
  });
  return response.data;
};

export const createSavingsFeePaymentSession = async (id: string) => {
  const response = await authenticatedRequest.post<{
    success: boolean;
    message: string;
    data: {
      sessionId: string;
      url: string;
      requestId: string;
    };
  }>(`/api/managed-services/${id}/savings-fee/payment`);
  return response.data;
};

export const deleteManagedService = async (id: string) => {
  const response = await authenticatedRequest.delete<{
    success: boolean;
    message: string;
  }>(`/api/managed-services/${id}`);
  return response.data;
};
