import React, { createContext, useContext, useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";

interface AuthContextType {
  isConnected: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isConnected: false,
  isLoading: true,
  login: () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  // Check auth status on initial load
  const { 
    data: authData = { loggedIn: false }, 
    isLoading,
    refetch: refetchAuthStatus 
  } = useQuery({
    queryKey: ['/api/auth/status'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  useEffect(() => {
    if (authData && authData.loggedIn) {
      setIsConnected(true);
    } else {
      setIsConnected(false);
    }
  }, [authData]);

  // Mutation for logout
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest({
        endpoint: '/api/auth/logout',
        method: 'GET',
        on401: 'throw'
      });
    },
    onSuccess: () => {
      setIsConnected(false);
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/status'] });
    },
    onError: (error) => {
      toast({
        title: "Logout failed",
        description: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    },
  });

  // Function to initiate Twitter auth
  const login = async () => {
    try {
      const response = await fetch('/api/auth/twitter');
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Authentication Error",
          description: "Failed to start the authentication process.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Authentication Error",
        description: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    }
  };

  // Function to logout
  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  // Values to be provided by the context
  const value = {
    isConnected,
    isLoading: isLoading || logoutMutation.isPending,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
