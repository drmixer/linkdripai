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
import DripsSimplePage from "@/pages/drips-simple";
import RedirectWrapper from "@/pages/redirect-wrapper";
import SavedProspects from "@/pages/saved-prospects";
import EmailOutreach from "@/pages/email-outreach";
import EmailOutreachDemo from "@/pages/email-outreach-demo";
import MultiChannelOutreachPage from "@/pages/multi-channel-outreach";
import Analytics from "@/pages/analytics";
import LandingPage from "@/pages/landing-page";
import PricingPage from "@/pages/pricing-page";
import Onboarding from "@/pages/onboarding-improved";
import WebsitesPage from "@/pages/websites";
import BillingPage from "@/pages/billing";
import HelpPage from "@/pages/help";
import SettingsPage from "@/pages/settings";
import AccountPage from "@/pages/account-page";

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => {
        // Check if user is logged in through localStorage to avoid blank screens
        const hasSession = localStorage.getItem('session') || sessionStorage.getItem('session');
        if (hasSession) {
          window.location.href = '/dashboard';
          return null;
        } else {
          return <LandingPage />;
        }
      }} />
      <Route path="/pricing" component={PricingPage} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/drips" component={DripsSimplePage} />
      <ProtectedRoute 
        path="/opportunities" 
        component={() => <RedirectWrapper to="/drips" />} 
      />
      <ProtectedRoute path="/saved-prospects" component={SavedProspects} />
      <ProtectedRoute path="/email-outreach" component={EmailOutreach} />
      <ProtectedRoute path="/email-outreach-demo" component={EmailOutreachDemo} />
      <ProtectedRoute path="/outreach/:id" component={MultiChannelOutreachPage} />
      <ProtectedRoute path="/analytics" component={Analytics} />
      <ProtectedRoute path="/onboarding" component={Onboarding} skipOnboardingCheck={true} />
      <ProtectedRoute path="/onboarding/improved" component={Onboarding} skipOnboardingCheck={true} />
      <ProtectedRoute path="/websites" component={WebsitesPage} />
      <ProtectedRoute path="/billing" component={BillingPage} />
      <ProtectedRoute path="/account" component={AccountPage} />
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
