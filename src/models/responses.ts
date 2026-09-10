export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
