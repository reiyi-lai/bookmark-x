import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { useState, useCallback } from "react";
import type { ClientBookmark as Bookmark } from "@shared/schema";
import { useToast } from "./use-toast";

interface BookmarksResponse {
  bookmarks: Bookmark[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export function useBookmarks(categoryId?: number, searchQuery?: string, page = 1, limit = 20) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const queryParams = new URLSearchParams();
  if (categoryId) {
    queryParams.append("categoryId", String(categoryId));
  }
  if (searchQuery) {
    queryParams.append("search", searchQuery);
  }
  queryParams.append("page", String(page));
  queryParams.append("limit", String(limit));
  queryParams.append("includeCount", "true");

  // Fetch bookmarks with pagination
  const {
    data: bookmarksData,
    isLoading,
    isError,
    refetch: refetchBookmarks
  } = useQuery({
    queryKey: ["/api/bookmarks", categoryId, searchQuery, page, limit],
    queryFn: async () => {
      const endpoint = `/api/bookmarks?${queryParams.toString()}`;
      try {
        return await apiRequest<BookmarksResponse>({
          endpoint,
          method: "GET",
          on401: "returnNull",
        });
      } catch (error) {
        console.error("Error fetching bookmarks:", error);
        toast({
          title: "Error",
          description: "Failed to load bookmarks. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    },
    staleTime: 60 * 1000, // stale time matches server cache
  });
  
  const bookmarks = bookmarksData?.bookmarks || [];
  const totalCount = bookmarksData?.pagination?.total || 0;

  // Sync bookmarks (refetch data)
  const { mutate: syncBookmarks, isPending: isSyncing } = useMutation({
    mutationFn: async () => {
      await refetchBookmarks();
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Bookmarks synced successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to sync bookmarks. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete bookmark
  const { mutate: deleteBookmark, isPending: isDeleting } = useMutation({
    mutationFn: async (bookmarkId: number) => {
      await apiRequest({
        endpoint: `/api/bookmarks/${bookmarkId}`,
        method: "DELETE",
        on401: "returnNull",
      });
      return bookmarkId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/bookmarks", categoryId, searchQuery, page, limit]
      });
      toast({
        title: "Success",
        description: "Bookmark deleted successfully",
      });
    },
    onError: (error: Error) => {
      console.error("Error deleting bookmark:", error);
      toast({
        title: "Error",
        description: "Failed to delete bookmark. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update bookmark category
  const { mutate: updateCategory, isPending: isUpdatingCategory } = useMutation({
    mutationFn: async ({ bookmarkId, categoryId: newCategoryId }: { bookmarkId: number; categoryId: number }) => {
      await apiRequest({
        endpoint: `/api/bookmarks/${bookmarkId}/category`,
        method: "PATCH",
        data: { categoryId: newCategoryId },
        on401: "returnNull",
      });
      return { bookmarkId, categoryId: newCategoryId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/bookmarks", categoryId, searchQuery, page, limit]
      });
      setCategoryModalOpen(false);
      setSelectedBookmark(null);
      toast({
        title: "Success",
        description: "Bookmark category updated successfully",
      });
    },
    onError: (error: Error) => {
      console.error("Error updating bookmark category:", error);
      toast({
        title: "Error",
        description: "Failed to update category. Please try again.",
        variant: "destructive",
      });
    },
  });

  const openCategoryModal = useCallback((bookmark: Bookmark) => {
    setSelectedBookmark(bookmark);
    setCategoryModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setCategoryModalOpen(false);
    setSelectedBookmark(null);
  }, []);

  return {
    bookmarks,
    totalCount,
    isLoading,
    isError,
    syncBookmarks,
    isSyncing,
    deleteBookmark,
    isDeleting,
    updateCategory,
    isUpdatingCategory,
    selectedBookmark,
    setSelectedBookmark,
    categoryModalOpen,
    openCategoryModal,
    closeModal
  };
}