export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface PaginatedResult<T> {
  [key: string]: T[] | number | undefined;
  total: number;
  page: number;
  per_page: number;
  pages: number;
}
