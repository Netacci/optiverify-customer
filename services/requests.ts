import { authenticatedRequest } from "@/lib/requestMethod";

// Types
export interface CreateRequestData {
  name: string;
  category: string;
  subCategory?: string;
  unitPrice: string | number;
  quantity?: string;
  description?: string;
  timeline?: string;
  location?: string;
  requirements?: string;
}

export interface CreateRequestResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    category: string;
    status: string;
    createdAt: string;
  };
}

export interface MatchResponse {
  success: boolean;
  message: string;
  data: {
    requestId: string;
    matchReportId?: string;
    isUnlocked?: boolean;
    // AI matching pipeline fields (set when MATCH_SCORER=ai on backend).
    // status="no_matches" means nothing scored above threshold — frontend
    // should render the managed-services CTA, not the normal preview.
    status?: "completed" | "no_matches";
    candidateCount?: number;
    matchedCount?: number;
    requestSummary?: string;
    suggestedAction?: "managed_services";
    preview?: {
      summary: string;
      category: string;
      matchedCount: number;
      matchScore: number;
      message?: string;
    };
  };
}

// API Functions

/**
 * Create a new request
 */
export const createRequest = async (
  data: CreateRequestData
): Promise<CreateRequestResponse> => {
  const response = await authenticatedRequest.post<CreateRequestResponse>(
    "/api/requests",
    data
  );
  return response.data;
};

/**
 * Submit request for matching
 */
export const submitForMatching = async (
  requestId: string
): Promise<MatchResponse> => {
  if (!requestId || typeof requestId !== "string") {
    throw new Error("Request ID is required");
  }
  const response = await authenticatedRequest.post<MatchResponse>(
    `/api/requests/${requestId}/match`
  );
  return response.data;
};

/**
 * Generate AI match for pending reports (for paid users who submitted via frontend)
 */
export const generateAIMatch = async (
  requestId: string
): Promise<MatchResponse> => {
  if (!requestId || typeof requestId !== "string") {
    throw new Error("Request ID is required");
  }
  const response = await authenticatedRequest.post<MatchResponse>(
    `/api/requests/${requestId}/generate-match`
  );
  return response.data;
};

