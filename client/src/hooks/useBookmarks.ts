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

  // Construct the query params
  const queryParams = new URLSearchParams();
  if (categoryId) {
    queryParams.append("categoryId", categoryId.toString());
  }

  // Fetch bookmarks with a single query that includes category counts
  const {
    data: bookmarksData = { bookmarks: [], categoryCounts: {} },
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ["/api/bookmarks", categoryId],
    queryFn: async () => {
      const endpoint = `/api/bookmarks?${queryParams.toString()}`;
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
  });
  
  // Apply search filtering
  const filteredBookmarks = useMemo(() => {
    if (!searchQuery || searchQuery.trim() === '') {
      return bookmarksData?.bookmarks || [];
    }
    
    const query = searchQuery.toLowerCase().trim();
    return (bookmarksData?.bookmarks || []).filter(bookmark => {
      return (
        bookmark.content?.toLowerCase().includes(query) ||
        bookmark.authorName?.toLowerCase().includes(query) ||
        bookmark.authorUsername?.toLowerCase().includes(query)
      );
    });
  }, [bookmarksData?.bookmarks, searchQuery]);
  
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

  // Recategorize all bookmarks
  // const { mutate: recategorizeBookmarks, isPending: isRecategorizing } = useMutation({
  //   mutationFn: async () => {
  //     return apiRequest({
  //       endpoint: "/api/bookmarks/recategorize",
  //       method: "POST",
  //       on401: "throw",
  //     });
  //   },
  //   onSuccess: (data) => {
  //     queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
  //     toast({
  //       title: "Success",
  //       description: `Recategorized ${data.stats?.updated || 0} bookmarks`,
  //     });
  //   },
  //   onError: (error: Error) => {
  //     console.error("Error recategorizing bookmarks:", error);
  //     toast({
  //       title: "Error",
  //       description: "Failed to recategorize bookmarks. Please try again.",
  //       variant: "destructive",
  //     });
  //   },
  // });

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
    // recategorizeBookmarks,
    // isRecategorizing,
    selectedBookmark,
    categoryModalOpen,
    openCategoryModal,
    closeModal,
    syncBookmarks,
    isSyncing
  };
}