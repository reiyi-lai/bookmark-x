import React from 'react';
import { Button } from '../components/ui/button';
import { Bookmark, LogIn } from 'lucide-react';

export default function LoggedOut() {
  const handleGoToBookmarks = () => {
    window.open('https://x.com/i/bookmarks', '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center">
          <div className="bg-blue-500 p-3 rounded-full">
            <Bookmark className="h-8 w-8 text-white" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            You've been logged out
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Thanks for using BookmarkBuddy! Your bookmarks are safely stored.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleGoToBookmarks}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white"
          >
            <LogIn className="h-4 w-4 mr-2" />
            Go to X.com Bookmarks to Login Again
          </Button>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Install the BookmarkBuddy extension and sync your bookmarks anytime!
          </p>
        </div>

        {/* Simple footer */}
        <div className="pt-8 text-xs text-gray-400 dark:text-gray-500">
          BookmarkBuddy - AI-powered bookmark organization
        </div>
      </div>
    </div>
  );
} 