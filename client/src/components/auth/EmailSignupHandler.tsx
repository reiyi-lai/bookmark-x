import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { EmailSignupModal } from './EmailSignupModal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';

export function EmailSignupHandler() {
  const [, setLocation] = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();
  const { signUpWithEmail, getCurrentUser, twitterAuth, appAuth } = useAuth();

  useEffect(() => {
    if (!appAuth.isAuthenticated) {
      setIsModalOpen(true);
    }
  }, [appAuth.isAuthenticated]);

  const handleEmailSubmit = async (email: string) => {
    try {
      // Get current user which will have Twitter info
      const user = await getCurrentUser();
      if (!user?.twitter_id || !user?.twitter_username) {
        throw new Error('Missing Twitter user information');
      }

      await signUpWithEmail(email, {
        id: user.twitter_id,
        username: user.twitter_username
      });

      // Close modal and redirect to home without query params
      setIsModalOpen(false);
      setLocation('/');

    } catch (error) {
      console.error('Error in email signup:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to register email',
        variant: 'destructive'
      });
      throw error;
    }
  };

  return (
    <EmailSignupModal
      isOpen={isModalOpen}
      onSubmit={handleEmailSubmit}
      onClose={() => setIsModalOpen(false)}
    />
  );
} 