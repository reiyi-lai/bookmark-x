import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { useState, useCallback, useMemo } from "react";
import type { ClientBookmark as Bookmark } from "@shared/schema";
import { useToast } from "./use-toast";

export function useBookmarks(categoryId?: number, searchQuery?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  // Fetch all bookmarks with data that includes category counts
  const {
    data: bookmarksData = { bookmarks: [], categoryCounts: {} },
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ["/api/bookmarks"],
    queryFn: async () => {
      const endpoint = `/api/bookmarks`;
      try {
        const response = await apiRequest<{ bookmarks: Bookmark[], categoryCounts: Record<number, number> }>({
          endpoint,
          method: "GET",
          on401: "returnNull",
        });
        return response;
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
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  // Apply category filtering on the client side
  const categoryFilteredBookmarks = useMemo(() => {
    const allBookmarks = bookmarksData?.bookmarks || [];
    
    // If no category selected or categoryId is 0 (All bookmarks), return all bookmarks
    if (!categoryId || categoryId === 0) return allBookmarks;
    
    // Otherwise filter by the selected category
    return allBookmarks.filter(bookmark => bookmark.categoryId === categoryId);
  }, [bookmarksData?.bookmarks, categoryId]);
  
  // Apply search filtering on category-filtered bookmarks
  const filteredBookmarks = useMemo(() => {
    if (!searchQuery || searchQuery.trim() === '') {
      return categoryFilteredBookmarks;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return categoryFilteredBookmarks.filter(bookmark => {
      return (
        bookmark.content?.toLowerCase().includes(query) ||
        bookmark.authorName?.toLowerCase().includes(query) ||
        bookmark.authorUsername?.toLowerCase().includes(query)
      );
    });
  }, [categoryFilteredBookmarks, searchQuery]);
  
  const categoryCounts = bookmarksData?.categoryCounts || {};

  // Sync bookmarks (refetch data)
  const { mutate: syncBookmarks, isPending: isSyncing } = useMutation({
    mutationFn: async () => {
      await refetch();
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

  // Delete a bookmark
  const { mutate: deleteBookmark, isPending: isDeleting } = useMutation({
    mutationFn: async (bookmarkId: string) => {
      return apiRequest({
        endpoint: `/api/bookmarks/${bookmarkId}`,
        method: "DELETE",
        on401: "throw",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
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
    mutationFn: async ({
      bookmarkId,
      categoryId,
    }: {
      bookmarkId: string;
      categoryId: number;
    }) => {
      return apiRequest({
        endpoint: `/api/bookmarks/${bookmarkId}/category`,
        method: "PATCH",
        data: { categoryId },
        on401: "throw",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
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
    bookmarks: filteredBookmarks,
    categoryCounts,
    isLoading,
    isError,
    refetch,
    deleteBookmark,
    isDeleting,
    updateCategory,
    isUpdatingCategory,
    selectedBookmark,
    categoryModalOpen,
    openCategoryModal,
    closeModal,
    syncBookmarks,
    isSyncing
  };
}