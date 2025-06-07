import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { EmailSignupModal } from './EmailSignupModal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';

export function EmailSignupHandler() {
  const [, setLocation] = useLocation();
  const [showEmailSignup, setShowEmailSignup] = useState(false);
  const { toast } = useToast();
  const { signUpWithEmail, getCurrentUser, appAuth, twitterAuth, isLoading, setState } = useAuth();

  useEffect(() => {
    const checkForSignupModal = async () => {
      // Wait for AuthContext to finish loading
      if (isLoading) {
        return;
      }

      // Handle edge case: app auth without Twitter auth (inconsistent state)
      if (!twitterAuth.isAuthenticated && appAuth.isAuthenticated) {
        console.warn('Inconsistent auth state: app auth without Twitter auth. Clearing app auth.');
        setState((prev) => ({
          ...prev,
          appAuth: {
            isAuthenticated: false,
            email: null,
            userId: null
          }
        }));
        return;
      }

      // Main case: Twitter auth exists but app auth doesn't - show signup modal
      if (twitterAuth.isAuthenticated && !appAuth.isAuthenticated) {
        try {
          // Double-check user exists before showing modal
          const user = await getCurrentUser();
          if (!user) {
            // User was deleted from database - clear sessionStorage and reset auth
            console.warn('User not found in database. Clearing session.');
            sessionStorage.removeItem('twitter_user_id');
            sessionStorage.removeItem('twitter_username');
            setState((prev) => ({
              ...prev,
              twitterAuth: {
                isAuthenticated: false,
                userId: null,
                username: null
              }
            }));
          } else {
            // User exists but no email - show signup modal
            setShowEmailSignup(true);
          }
        } catch (error) {
          console.error('Error checking user in database:', error);
          // On error, show signup modal for safety
          setShowEmailSignup(true);
        }
      }
    };

    checkForSignupModal();
  }, [isLoading, twitterAuth.isAuthenticated, appAuth.isAuthenticated, getCurrentUser, setState]);

  const handleEmailSubmit = async (email: string) => {
    try {
      const user = await getCurrentUser();
      if (!user?.twitter_id) {
        throw new Error('Missing Twitter user information');
      }

      await signUpWithEmail(email, {
        id: user.twitter_id,
        username: user.twitter_username
      });

      // Navigate to home page after successful signup
      setLocation('/');
    } catch (error) {
      // console.error('Error in email signup:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to register email';
      if (errorMessage.includes('Email already exists under another x.com account')) {
        toast({
          title: 'Enter another email',
          description: 'Email already exists under another x.com account.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive'
        });
      }
      
      throw error; // Re-throw so modal can handle the error state
    }
  };

  const handleCloseModal = () => {
    setShowEmailSignup(false);
  };

  return (
    <EmailSignupModal
      isOpen={showEmailSignup}
      onSubmit={handleEmailSubmit}
      onClose={handleCloseModal}
    />
  );
} 