import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, ApiError } from './api';
import type { Me, BooksPage } from './api';

export function useMe() {
  return useQuery<Me | null>({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await apiGet<Me>('/api/v1/auth/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    retry: false,
    staleTime: 60000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { username: string; password: string }) =>
      apiPost<Me>('/api/v1/auth/login', vars),
    onSuccess: (data) => {
      queryClient.setQueryData(['me'], data);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost('/api/v1/auth/logout'),
    onSuccess: () => {
      queryClient.setQueryData(['me'], null);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useBooks(page: number) {
  return useQuery<BooksPage>({
    queryKey: ['books', page],
    queryFn: () => apiGet<BooksPage>(`/api/v1/books?page=${page}&per_page=24`),
    placeholderData: (prev) => prev,
  });
}
