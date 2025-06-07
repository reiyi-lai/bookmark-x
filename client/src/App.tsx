import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import NotFound from "./pages/not-found";
import Home from "./pages/home";
import LoggedOut from "./pages/logged-out";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { EmailSignupHandler } from "./components/auth/EmailSignupHandler";

function Router() {
  const { twitterAuth, appAuth, isLoading } = useAuth();

  // Show loading while auth is initializing
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  // Show logged-out page if no Twitter auth
  if (!twitterAuth.isAuthenticated) {
    return <LoggedOut />;
  }

  // Show main app if authenticated
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <ThemeProvider>
        <Router />
          <EmailSignupHandler />
        <Toaster />
      </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
