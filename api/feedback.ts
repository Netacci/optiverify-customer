import { authenticatedRequest } from "@/lib/requestMethod";

// Types
export interface SubmitFeedbackData {
  type: "request" | "matching_service" | "general" | "billing";
  requestId?: string;
  matchingServiceId?: string;
  transactionId?: string;
  subject: string;
  message: string;
  rating?: number;
}

export interface FeedbackReply {
  sender: "user" | "admin";
  message: string;
  createdAt: string;
  adminId?: {
    email: string;
  };
}

export interface Feedback {
  _id: string;
  userId: string;
  email: string;
  type: "request" | "matching_service" | "general" | "billing";
  requestId?: any;
  matchingServiceId?: any;
  transactionId?: any;
  subject: string;
  message: string;
  status: "new" | "read" | "replied" | "resolved";
  rating?: number;
  replies: FeedbackReply[];
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackResponse {
  success: boolean;
  message: string;
  data: Feedback;
}

export interface GetFeedbackResponse {
  success: boolean;
  data: {
    feedback: Feedback[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

// API Functions

/**
 * Submit feedback
 */
export const submitFeedback = async (
  data: SubmitFeedbackData
): Promise<FeedbackResponse> => {
  const response = await authenticatedRequest.post<FeedbackResponse>(
    "/api/feedback",
    data
  );
  return response.data;
};

/**
 * Get all feedback
 */
export const getFeedback = async (params?: { page?: number; limit?: number }): Promise<GetFeedbackResponse> => {
  const response = await authenticatedRequest.get<GetFeedbackResponse>(
    "/api/feedback",
    { params }
  );
  return response.data;
};

/**
 * Reply to feedback
 */
export const replyToFeedback = async (id: string, message: string): Promise<FeedbackResponse> => {
  const response = await authenticatedRequest.post<FeedbackResponse>(
    `/api/feedback/${id}/reply`,
    { message }
  );
  return response.data;
};
