import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { EmailSignupModal } from './EmailSignupModal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';

export function EmailSignupHandler() {
  const [, setLocation] = useLocation();
  const [showEmailSignup, setShowEmailSignup] = useState(false);
  const { toast } = useToast();
  const { signUpWithEmail, getCurrentUser, appAuth, setState } = useAuth();

  useEffect(() => {
    const checkExistingUser = async () => {
      if (!appAuth.isAuthenticated) {
        // Check if user already exists in our database
        const user = await getCurrentUser();
        if (user?.email) {
          // Existing user - automatically sign them in
          setState((prev) => ({
            ...prev,
            appAuth: {
              isAuthenticated: true,
              email: user.email,
              userId: user.id
            }
          }));
          return;
        }
        // New user - show email signup modal
        setShowEmailSignup(true);
      }
    };

    checkExistingUser();
  }, [appAuth.isAuthenticated, getCurrentUser, setState]);

  const handleEmailSubmit = async (email: string) => {
    try {
      const user = await getCurrentUser();
      if (!user?.twitter_id || !user?.twitter_username) {
        throw new Error('Missing Twitter user information');
      }

      await signUpWithEmail(email, {
        id: user.twitter_id,
        username: user.twitter_username
      });

      setShowEmailSignup(false);
      setLocation('/');
    } catch (error) {
      console.error('Error in email signup:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to register email',
        variant: 'destructive'
      });
    }
  };

  return (
    <EmailSignupModal
      isOpen={showEmailSignup}
      onSubmit={handleEmailSubmit}
    />
  );
} 