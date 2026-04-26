import { publicRequest } from "@/lib/requestMethod";

export interface SystemSettings {
  savingsFeePercentage: number;
  extraCreditPrice: number;
  currency: string;
  gradePrices?: { [key: string]: number };
  urgencyFees?: { [key: string]: { fee: number; duration: string } };
}

/**
 * Get public system settings (pricing)
 */
export const getSystemSettings = async (): Promise<{
  success: boolean;
  data: SystemSettings;
}> => {
  const response = await publicRequest.get<{
    success: boolean;
    data: SystemSettings;
  }>("/api/settings/public");
  return response.data;
};
