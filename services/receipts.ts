import { authenticatedRequest } from "@/lib/requestMethod";

export interface Receipt {
  id: string;
  type: "match_report" | "managed_service" | "managed_service_savings_fee" | "top_up";
  amount: number;
  currency: string;
  planType?: string;
  paidAt: string;
  createdAt: string;
  paymentMethod?: "stripe" | "credits";
  request?: {
    id: string;
    name?: string;
    category?: string;
    specifications?: string;
  };
  service?: {
    id: string;
    itemName?: string;
    category?: string;
    specifications?: string;
    quantity?: string;
    deliveryLocation?: string;
    savingsAmount?: number;
    savingsFeePercentage?: number;
    finalReport?: any;
  };
  credits?: number;
  description?: string;
  matchReport?: {
    id: string;
    status?: string;
  };
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
  const url = `/api/transactions${queryString ? `?${queryString}` : ""}`;
  const response = await authenticatedRequest.get<{ success: boolean; data: { transactions: Receipt[]; pagination: { page: number; limit: number; total: number; totalPages: number } } }>(url);
  return response.data;
};

export const getPaymentReceipt = async (paymentId: string): Promise<{ success: boolean; data: Receipt }> => {
  const response = await authenticatedRequest.get<{ success: boolean; data: Receipt }>(`/api/transactions/payment/${paymentId}`);
  return response.data;
};

export const getManagedServiceReceipt = async (serviceId: string): Promise<{ success: boolean; data: Receipt }> => {
  const response = await authenticatedRequest.get<{ success: boolean; data: Receipt }>(`/api/transactions/managed-service/${serviceId}`);
  return response.data;
};

export const getManagedServiceSavingsFeeReceipt = async (serviceId: string): Promise<{ success: boolean; data: Receipt }> => {
  const response = await authenticatedRequest.get<{ success: boolean; data: Receipt }>(`/api/transactions/managed-service/${serviceId}/savings-fee`);
  return response.data;
};

export const getReceiptById = async (transactionId: string): Promise<{ success: boolean; data: Receipt }> => {
  const response = await authenticatedRequest.get<{ success: boolean; data: Receipt }>(`/api/transactions/${transactionId}`);
  return response.data;
};

