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
import Onboarding from "@/pages/onboarding-improved";
import WebsitesPage from "@/pages/websites";
import BillingPage from "@/pages/billing";
import HelpPage from "@/pages/help";
import SettingsPage from "@/pages/settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/pricing" component={PricingPage} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      {/* Use a custom route for opportunities to ensure it maintains sidebar */}
      <Route path="/opportunities">
        {() => {
          // This ensures the component is rendered directly in the route
          return <ProtectedRoute path="/opportunities" component={Opportunities} />;
        }}
      </Route>
      <ProtectedRoute path="/saved-prospects" component={SavedProspects} />
      <ProtectedRoute path="/email-outreach" component={EmailOutreach} />
      <ProtectedRoute path="/analytics" component={Analytics} />
      <ProtectedRoute path="/onboarding" component={Onboarding} skipOnboardingCheck={true} />
      <ProtectedRoute path="/onboarding/improved" component={Onboarding} skipOnboardingCheck={true} />
      <ProtectedRoute path="/websites" component={WebsitesPage} />
      <ProtectedRoute path="/billing" component={BillingPage} />
      <ProtectedRoute path="/help" component={HelpPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
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
