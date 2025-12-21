import { publicRequest } from "@/lib/requestMethod";

export interface Plan {
  _id: string;
  name: string;
  planType: "basic" | "starter" | "professional";
  description?: string;
  price: number;
  hasAnnualPricing: boolean;
  annualPrice?: number;
  credits: number;
  features: string[];
  maxRolloverCredits?: number;
  isActive: boolean;
  displayOrder: number;
  isPopular: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get active plans for public display
 */
export const getPlans = async (): Promise<{
  success: boolean;
  data: Plan[];
}> => {
  const response = await publicRequest.get<{
    success: boolean;
    data: Plan[];
  }>("/api/plans");
  return response.data;
};
