// Common types for the API layer.

export interface ApiErrorBody {
  statusCode?: number;
  error?: string;
  message: string;
  code: string;
  details?: Record<string, unknown>;
  requestId: string;
  timestamp?: string;
}

export interface ApiErrorEnvelope {
  error: ApiErrorBody;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CursorPageParams {
  cursor?: string | null;
  limit?: number;
}
