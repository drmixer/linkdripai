import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import Dashboard from "@/pages/dashboard";
import AuthPage from "@/pages/auth-page";
import Opportunities from "@/pages/opportunities";
import SavedProspects from "@/pages/saved-prospects";
import EmailOutreach from "@/pages/email-outreach";
import Analytics from "@/pages/analytics";
import LandingPage from "@/pages/landing-page";
import PricingPage from "@/pages/pricing-page";
import Onboarding from "@/pages/onboarding-new";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/opportunities" component={Opportunities} />
      <ProtectedRoute path="/saved-prospects" component={SavedProspects} />
      <ProtectedRoute path="/email-outreach" component={EmailOutreach} />
      <ProtectedRoute path="/analytics" component={Analytics} />
      <ProtectedRoute path="/onboarding" component={Onboarding} skipOnboardingCheck={true} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
