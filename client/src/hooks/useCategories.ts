import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import type { Category } from "@shared/schema";
import { useToast } from "./use-toast";

export function useCategories() {
  const { toast } = useToast();

  const {
    data: categories = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      try {
        return await apiRequest<Category[]>({
          endpoint: "/api/categories",
          method: "GET",
          on401: "returnNull",
        });
      } catch (error) {
        console.error("Error fetching categories:", error);
        toast({
          title: "Error",
          description: "Failed to load categories. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    },
  });

  return {
    categories,
    isLoading,
    isError,
  };
}