import { publicRequest } from "@/lib/requestMethod";

export interface Category {
  _id: string;
  name: string;
  grade?: "low" | "medium" | "high";
  isActive: boolean;
}

export interface CategoriesResponse {
  success: boolean;
  data: Category[];
}

/**
 * Get all active categories (public endpoint)
 */
export const getCategories = async (): Promise<CategoriesResponse> => {
  const response = await publicRequest.get<CategoriesResponse>(
    "/api/categories"
  );
  return response.data;
};
