import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiUpload, ApiError } from './api';
import type {
  Me, BooksPage, BookDetail, EntityList, Shelf, ShelfDetail,
  SearchOptions, AdvancedSearchParams, AdvSearchResult, Account, ProfileUpdate,
  BookMetadata, MetadataUpdate, UploadResult,
} from './api';

/** Entity kinds the catalog can be filtered by. Singular here; the browse-list
 *  endpoints/routes use the plural (author -> authors). */
export type EntityKind = 'author' | 'series' | 'tag' | 'publisher' | 'language';
export type ReadFilter = 'all' | 'read' | 'unread';

/** Map a singular entity kind to its plural browse endpoint/route segment. */
export const ENTITY_PLURAL: Record<EntityKind, string> = {
  author: 'authors',
  series: 'series',
  tag: 'tags',
  publisher: 'publishers',
  language: 'languages',
};

export interface BooksQuery {
  page: number;
  search?: string;
  sort?: string;
  readFilter?: ReadFilter;
  entityKind?: EntityKind;
  entityId?: string | number;
}

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

export function useBooks(q: BooksQuery) {
  const { page, search = '', sort = 'new', readFilter = 'all', entityKind, entityId } = q;
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('per_page', '24');
  params.set('sort', sort);
  // The API's search path is separate from entity/read filtering, so search is
  // only sent in the unfiltered library view (the UI hides the search box when
  // an entity filter is active).
  if (search && !entityKind) params.set('search', search);
  if (readFilter !== 'all') params.set('filter', readFilter);
  if (entityKind && entityId !== undefined && entityId !== '') {
    params.set(entityKind, String(entityId));
  }
  return useQuery<BooksPage>({
    queryKey: ['books', page, search, sort, readFilter, entityKind ?? '', entityId ?? ''],
    queryFn: () => apiGet<BooksPage>(`/api/v1/books?${params.toString()}`),
    placeholderData: (prev) => prev,
  });
}

/** Fetch an entity-browse list (authors/series/tags/publishers/languages).
 *  `plural` is the endpoint segment (e.g. "authors"). */
export function useEntityList(plural: string) {
  return useQuery<EntityList>({
    queryKey: ['entities', plural],
    queryFn: () => apiGet<EntityList>(`/api/v1/${plural}`),
    staleTime: 60000,
  });
}

export function useBook(id: string | number) {
  return useQuery<BookDetail>({
    queryKey: ['book', String(id)],
    queryFn: () => apiGet<BookDetail>(`/api/v1/books/${id}`),
  });
}

export function useToggleRead(id: string | number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (read: boolean) =>
      apiPost<{ read: boolean }>(`/api/v1/books/${id}/read`, { read }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['book', String(id)] });
    },
  });
}

// ── Shelves ──────────────────────────────────────────────────────────────────

export function useShelves() {
  return useQuery<{ items: Shelf[] }>({
    queryKey: ['shelves'],
    queryFn: () => apiGet<{ items: Shelf[] }>('/api/v1/shelves'),
    staleTime: 30000,
  });
}

export function useShelf(id: string | number | undefined, page = 1) {
  return useQuery<ShelfDetail>({
    queryKey: ['shelf', String(id), page],
    queryFn: () => apiGet<ShelfDetail>(`/api/v1/shelves/${id}?page=${page}&per_page=24`),
    enabled: id !== undefined && id !== '',
    placeholderData: (prev) => prev,
  });
}

/** Shelf ids (among the user's visible shelves) that currently contain a book. */
export function useBookShelves(bookId: string | number) {
  return useQuery<{ shelf_ids: number[] }>({
    queryKey: ['book-shelves', String(bookId)],
    queryFn: () => apiGet<{ shelf_ids: number[] }>(`/api/v1/books/${bookId}/shelves`),
  });
}

export function useCreateShelf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; is_public?: boolean }) =>
      apiPost<Shelf>('/api/v1/shelves', vars),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['shelves'] }),
  });
}

export function useUpdateShelf(id: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name?: string; is_public?: boolean; kobo_sync?: boolean }) =>
      apiPost<Shelf>(`/api/v1/shelves/${id}`, vars),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shelves'] });
      void qc.invalidateQueries({ queryKey: ['shelf', String(id)] });
    },
  });
}

export function useDeleteShelf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiPost(`/api/v1/shelves/${id}/delete`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['shelves'] }),
  });
}

// ── Upload ───────────────────────────────────────────────────────────────────

export function useUploadBooks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => {
      const fd = new FormData();
      for (const f of files) fd.append('file', f);
      return apiUpload<UploadResult>('/api/v1/upload', fd);
    },
    onSuccess: () => {
      // The library will populate as ingest processes; nudge the catalog.
      void qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

// ── Edit metadata ────────────────────────────────────────────────────────────

export function useBookMetadata(id: string | number) {
  return useQuery<BookMetadata>({
    queryKey: ['metadata', String(id)],
    queryFn: () => apiGet<BookMetadata>(`/api/v1/books/${id}/metadata`),
  });
}

export function useUpdateMetadata(id: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: MetadataUpdate) => apiPost<BookMetadata>(`/api/v1/books/${id}/metadata`, vars),
    onSuccess: (data) => {
      qc.setQueryData(['metadata', String(id)], data);
      // The detail/catalog views show the same fields — refresh them.
      void qc.invalidateQueries({ queryKey: ['book', String(id)] });
      void qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

// ── Reader (bookmark / progress) ─────────────────────────────────────────────

export function useBookmark(bookId: string | number, format = 'epub') {
  return useQuery<{ bookmark: string | null }>({
    queryKey: ['bookmark', String(bookId), format],
    queryFn: () => apiGet<{ bookmark: string | null }>(
      `/api/v1/books/${bookId}/bookmark?format=${encodeURIComponent(format)}`),
    staleTime: 0,
  });
}

export function useSaveBookmark(bookId: string | number) {
  return useMutation({
    mutationFn: (vars: { format: string; bookmark: string }) =>
      apiPost(`/api/v1/books/${bookId}/bookmark`, vars),
  });
}

// ── Account ──────────────────────────────────────────────────────────────────

export function useAccount() {
  return useQuery<Account>({
    queryKey: ['account'],
    queryFn: () => apiGet<Account>('/api/v1/account'),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: ProfileUpdate) => apiPost<Account>('/api/v1/account/profile', vars),
    onSuccess: (data) => {
      qc.setQueryData(['account'], data);
      // name/locale also surface in the top bar via useMe
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (vars: { current_password: string; new_password: string }) =>
      apiPost('/api/v1/account/password', vars),
  });
}

// ── Advanced search ──────────────────────────────────────────────────────────

export function useSearchOptions() {
  return useQuery<SearchOptions>({
    queryKey: ['search-options'],
    queryFn: () => apiGet<SearchOptions>('/api/v1/search/options'),
    staleTime: 60000,
  });
}

/** Run advanced search. `params` is null until the user submits, which keeps the
 *  query disabled (and the results pane empty) on first load. */
export function useAdvancedSearch(params: AdvancedSearchParams | null, page: number) {
  return useQuery<AdvSearchResult>({
    queryKey: ['adv-search', params, page],
    queryFn: () => apiPost<AdvSearchResult>('/api/v1/search/advanced', { ...params, page, per_page: 24 }),
    enabled: params !== null,
    placeholderData: (prev) => prev,
  });
}

/** Add or remove a book from a shelf; invalidates the affected caches. */
export function useShelfMembership() {
  const qc = useQueryClient();
  const invalidate = (shelfId: number, bookId: number) => {
    void qc.invalidateQueries({ queryKey: ['shelf', String(shelfId)] });
    void qc.invalidateQueries({ queryKey: ['shelves'] });
    void qc.invalidateQueries({ queryKey: ['book-shelves', String(bookId)] });
  };
  const add = useMutation({
    mutationFn: (v: { shelfId: number; bookId: number }) =>
      apiPost(`/api/v1/shelves/${v.shelfId}/books/${v.bookId}`),
    onSuccess: (_d, v) => invalidate(v.shelfId, v.bookId),
  });
  const remove = useMutation({
    mutationFn: (v: { shelfId: number; bookId: number }) =>
      apiPost(`/api/v1/shelves/${v.shelfId}/books/${v.bookId}/delete`),
    onSuccess: (_d, v) => invalidate(v.shelfId, v.bookId),
  });
  return { add, remove };
}
