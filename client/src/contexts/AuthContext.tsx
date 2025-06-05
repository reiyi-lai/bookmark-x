import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/queryClient';

interface TwitterAuth {
  isAuthenticated: boolean;
  userId: string | null;
  username: string | null;
}

interface AppAuth {
  isAuthenticated: boolean;
  email: string | null;
  userId: string | null;
}

interface AuthState {
  twitterAuth: TwitterAuth;
  appAuth: AppAuth;
  isLoading: boolean;
}

interface TwitterUser {
  id: string;
  username: string;
}

interface User {
  id: string;
  email: string;
  twitter_id: string;
  twitter_username: string;
}

interface AuthContextType extends AuthState {
  checkTwitterAuth: () => Promise<boolean>;
  signUpWithEmail: (email: string, twitterUser: TwitterUser) => Promise<User>;
  getCurrentUser: () => Promise<User | null>;
  updateUserEmail: (userId: string, email: string) => Promise<void>;
  isFullyAuthenticated: () => boolean;
  logout: () => Promise<void>;
}

const initialState: AuthState = {
  twitterAuth: {
    isAuthenticated: false,
    userId: null,
    username: null
  },
  appAuth: {
    isAuthenticated: false,
    email: null,
    userId: null
  },
  isLoading: true
};

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AuthState>(initialState);

  const getCurrentUser = useCallback(async (): Promise<User | null> => {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .single();

      if (error) throw error;
      return user;
    } catch (error) {
      console.error('Error getting current user from Supabase:', error);
      return null;
    }
  }, []);

  const checkTwitterAuth = useCallback(async (): Promise<boolean> => {
    return !!localStorage.getItem('twitter_user_id');
  }, []);

  const signUpWithEmail = useCallback(async (email: string, twitterUser: TwitterUser): Promise<User> => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser?.id) {
        throw new Error('User not found');
      }

      await apiRequest({
        endpoint: `/api/users/${currentUser.id}/complete-registration`,
        method: 'POST',
        data: { email },
        on401: 'throw'
      });

      const updatedUser = await getCurrentUser();
      if (!updatedUser) {
        throw new Error('Failed to get updated user');
      }

      setState(prev => ({
        ...prev,
        appAuth: {
          isAuthenticated: true,
          email: updatedUser.email,
          userId: updatedUser.id
        }
      }));

      return updatedUser;
    } catch (error) {
      console.error('Error in signUpWithEmail:', error);
      throw error;
    }
  }, [getCurrentUser]);

  const updateUserEmail = useCallback(async (userId: string, email: string): Promise<void> => {
    try {
      await apiRequest({
        endpoint: `/api/users/${userId}/complete-registration`,
        method: 'POST',
        data: { email },
        on401: 'throw'
      });

      setState(prev => ({
        ...prev,
        appAuth: {
          ...prev.appAuth,
          email: email,
          isAuthenticated: true
        }
      }));
    } catch (error) {
      console.error('Error updating user email:', error);
      throw new Error('Failed to update email');
    }
  }, []);

  const isFullyAuthenticated = useCallback((): boolean => {
    return state.twitterAuth.isAuthenticated && state.appAuth.isAuthenticated;
  }, [state.twitterAuth.isAuthenticated, state.appAuth.isAuthenticated]);

  const logout = useCallback(async (): Promise<void> => {
    localStorage.removeItem('twitter_user_id');
    localStorage.removeItem('twitter_username');
    setState({
      twitterAuth: {
        isAuthenticated: false,
        userId: null,
        username: null
      },
      appAuth: {
        isAuthenticated: false,
        email: null,
        userId: null
      },
      isLoading: false
    });
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const twitterAuth = await checkTwitterAuth();
        const user = await getCurrentUser();
        
        setState(prev => ({
          ...prev,
          twitterAuth: {
            isAuthenticated: twitterAuth,
            userId: localStorage.getItem('twitter_user_id'),
            username: localStorage.getItem('twitter_username')
          },
          appAuth: {
            isAuthenticated: !!user?.email,
            email: user?.email || null,
            userId: user?.id || null
          },
          isLoading: false
        }));
      } catch (error) {
        console.error('Error initializing auth:', error);
        setState(prev => ({ 
          ...prev, 
          twitterAuth: {
            isAuthenticated: false,
            userId: null,
            username: null
          },
          appAuth: {
            isAuthenticated: false,
            email: null,
            userId: null
          },
          isLoading: false 
        }));
      }
    };

    initializeAuth();
  }, [checkTwitterAuth, getCurrentUser]);

  const value: AuthContextType = {
    ...state,
    checkTwitterAuth,
    signUpWithEmail,
    getCurrentUser,
    updateUserEmail,
    isFullyAuthenticated,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 