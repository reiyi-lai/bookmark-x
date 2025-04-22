import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/button";
import { Bookmark, LogIn } from "lucide-react";
import { Card, CardContent } from "../ui/card";

export default function LoginOverlay() {
  const { login, isLoading } = useAuth();

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <Card className="bg-white dark:bg-dark-200 rounded-xl shadow-xl max-w-md w-full">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center">
            <div className="text-twitterBlue mb-6">
              <Bookmark className="h-16 w-16" />
            </div>
            
            <h1 className="text-2xl font-semibold mb-2">Twitter Bookmark Organizer</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Connect your Twitter account to automatically organize your bookmarks into categories.
            </p>
            
            <Button 
              onClick={login} 
              disabled={isLoading}
              className="flex items-center bg-twitterBlue hover:bg-blue-500 text-white font-medium py-2 px-6 rounded-full transition-colors"
            >
              <LogIn className="mr-2 h-5 w-5" />
              {isLoading ? "Connecting..." : "Connect Twitter Account"}
            </Button>
            
            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              We'll only access your bookmarks with your permission.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
