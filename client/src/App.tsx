import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import NotFound from "./pages/not-found";
import Home from "./pages/home";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { EmailSignupHandler } from "./components/auth/EmailSignupHandler";

function Router() {
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
