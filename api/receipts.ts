import { authenticatedRequest } from "@/lib/requestMethod";

export interface Receipt {
  id: string;
  type: "match_report" | "managed_service" | "managed_service_savings_fee" | "top_up";
  amount: number;
  currency: string;
  planType?: string;
  paidAt: string;
  createdAt: string;
  request?: {
    id: string;
    category?: string;
    specifications?: string;
  };
  service?: {
    id: string;
    category?: string;
    specifications?: string;
    quantity?: string;
    deliveryLocation?: string;
    savingsAmount?: number;
    savingsFeePercentage?: number;
  };
  credits?: number;
  description?: string;
  stripe?: {
    paymentIntentId: string;
    receiptUrl: string | null;
    billingDetails: any;
  };
}

export const getAllReceipts = async (params?: { page?: number; limit?: number }): Promise<{ success: boolean; data: { transactions: Receipt[]; pagination: { page: number; limit: number; total: number; totalPages: number } } }> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append("page", params.page.toString());
  if (params?.limit) queryParams.append("limit", params.limit.toString());
  const queryString = queryParams.toString();
  const url = `/api/receipts${queryString ? `?${queryString}` : ""}`;
  const response = await authenticatedRequest.get<{ success: boolean; data: { transactions: Receipt[]; pagination: { page: number; limit: number; total: number; totalPages: number } } }>(url);
  return response.data;
};

export const getPaymentReceipt = async (paymentId: string): Promise<{ success: boolean; data: Receipt }> => {
  const response = await authenticatedRequest.get<{ success: boolean; data: Receipt }>(`/api/receipts/payment/${paymentId}`);
  return response.data;
};

export const getManagedServiceReceipt = async (serviceId: string): Promise<{ success: boolean; data: Receipt }> => {
  const response = await authenticatedRequest.get<{ success: boolean; data: Receipt }>(`/api/receipts/managed-service/${serviceId}`);
  return response.data;
};

export const getManagedServiceSavingsFeeReceipt = async (serviceId: string): Promise<{ success: boolean; data: Receipt }> => {
  const response = await authenticatedRequest.get<{ success: boolean; data: Receipt }>(`/api/receipts/managed-service/${serviceId}/savings-fee`);
  return response.data;
};

