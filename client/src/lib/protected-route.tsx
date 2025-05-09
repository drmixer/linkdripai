import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
  skipOnboardingCheck,
}: {
  path: string;
  component: () => React.JSX.Element;
  skipOnboardingCheck?: boolean;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Check for onboarding just completed flag in localStorage
  const onboardingJustCompleted = typeof window !== 'undefined' ? 
    localStorage.getItem('onboardingJustCompleted') === 'true' : false;
  
  // If we have the flag, clear it and allow access to dashboard
  if (onboardingJustCompleted && path === "/dashboard") {
    console.log("Detected onboardingJustCompleted flag, allowing access to dashboard");
    localStorage.removeItem('onboardingJustCompleted');
    localStorage.removeItem('redirectAfterReload');
  }
  // Otherwise, check if user needs to complete onboarding
  else if (!skipOnboardingCheck && 
           path !== "/onboarding" && 
           path !== "/onboarding/improved" && 
           user.onboardingCompleted === false) {
    console.log(`ProtectedRoute for ${path}: Redirecting to onboarding because onboardingCompleted is false`);
    return (
      <Route path={path}>
        <Redirect to="/onboarding" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}
