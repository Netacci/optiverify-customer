import { publicRequest } from "@/lib/requestMethod";

export interface Subcategory {
  _id: string;
  name: string;
  isActive: boolean;
}

export interface Category {
  _id: string;
  name: string;
  grade?: "low" | "medium" | "high";
  isActive: boolean;
  subcategories?: Subcategory[];
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

/**
 * Get subcategories for a specific category
 */
export const getSubcategories = async (
  categoryId: string
): Promise<{ success: boolean; data: Subcategory[] }> => {
  const response = await publicRequest.get<{ success: boolean; data: Subcategory[] }>(
    `/api/categories/${categoryId}/subcategories`
  );
  return response.data;
};
