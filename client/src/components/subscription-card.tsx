import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CalendarClock, CreditCard, Crown, Check, Sparkles } from "lucide-react";

// Subscription plan configuration
const PLAN_DETAILS = {
  "Starter": {
    name: "Starter",
    price: 9,
    websites: 1,
    dripsPerDay: 5,
    splashesPerMonth: 1,
    description: "Perfect for individuals getting started with link building",
  },
  "Grow": {
    name: "Grow",
    price: 19,
    websites: 2,
    dripsPerDay: 10,
    splashesPerMonth: 3,
    description: "Ideal for small businesses looking to scale their outreach",
  },
  "Pro": {
    name: "Pro",
    price: 39,
    websites: 5,
    dripsPerDay: 15,
    splashesPerMonth: 7,
    description: "For agencies and serious link builders who need maximum results",
  },
  "Free Trial": {
    name: "Free Trial",
    price: 0,
    websites: 1,
    dripsPerDay: 3,
    splashesPerMonth: 0,
    description: "Try LinkDripAI with limited features",
  }
};

interface SubscriptionCardProps {
  className?: string;
}

export function SubscriptionCard({ className }: SubscriptionCardProps) {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string>("Starter");

  // Fetch subscription data
  const { data: subscriptionData, isLoading } = useQuery({
    queryKey: ["/api/payments/subscription"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/payments/subscription");
      const data = await response.json();
      return data.subscription;
    },
    staleTime: 60 * 1000, // 1 minute
  });

  // Fetch available plans
  const { data: plansData } = useQuery({
    queryKey: ["/api/payments/plans"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/payments/plans");
      return await response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Create checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await apiRequest("POST", "/api/payments/checkout/subscription", { planId });
      return await response.json();
    },
    onSuccess: (data) => {
      // Redirect to Lemon Squeezy checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({
          title: "Checkout Error",
          description: "Unable to create checkout. Please try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Checkout Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate days left if renewsAt is available
  const calculateDaysLeft = (renewsAt: string) => {
    const renewDate = new Date(renewsAt);
    const now = new Date();
    const diffTime = renewDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Get current plan details
  const currentPlan = subscriptionData?.plan || "Free Trial";
  const currentPlanDetails = PLAN_DETAILS[currentPlan as keyof typeof PLAN_DETAILS] || PLAN_DETAILS["Free Trial"];
  
  // Handle checkout
  const handleCheckout = () => {
    checkoutMutation.mutate(selectedPlan.toLowerCase());
  };

  if (isLoading) {
    return (
      <Card className={`w-full ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Loading Subscription...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // If user has an active subscription
  if (subscriptionData?.isActive) {
    const daysLeft = subscriptionData.renewsAt ? calculateDaysLeft(subscriptionData.renewsAt) : 0;
    
    return (
      <Card className={`w-full ${className}`}>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Your Subscription
            </CardTitle>
            <Badge variant="outline" className="bg-primary/10 text-primary">
              {subscriptionData.status}
            </Badge>
          </div>
          <CardDescription>
            {currentPlanDetails.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Current Plan</span>
              <span className="font-semibold">{currentPlan}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Monthly Price</span>
              <span className="font-semibold">${currentPlanDetails.price}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Websites</span>
              <span className="font-semibold">{currentPlanDetails.websites}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Drips Per Day</span>
              <span className="font-semibold">{currentPlanDetails.dripsPerDay} / website</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Splashes Per Month</span>
              <span className="font-semibold">{currentPlanDetails.splashesPerMonth}</span>
            </div>
            
            {subscriptionData.renewsAt && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <CalendarClock className="h-4 w-4" />
                  Next Billing Date
                </span>
                <span className="font-semibold">
                  {new Date(subscriptionData.renewsAt).toLocaleDateString()}
                  {daysLeft > 0 && ` (${daysLeft} days left)`}
                </span>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <div className="w-full flex flex-col gap-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(subscriptionData.urls?.customer_portal, '_blank')}
              disabled={!subscriptionData.urls?.customer_portal}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Manage Billing
            </Button>
            
            <div className="text-xs text-muted-foreground text-center">
              Need to change your plan? Visit the billing portal to manage your subscription.
            </div>
          </div>
        </CardFooter>
      </Card>
    );
  }

  // If user doesn't have an active subscription
  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          Choose a Plan
        </CardTitle>
        <CardDescription>
          Select a plan that fits your needs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plansData?.plans && plansData.plans.map((plan: any) => (
              <div
                key={plan.id}
                className={`
                  border rounded-lg p-4 cursor-pointer transition-all
                  ${selectedPlan === plan.name ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                `}
                onClick={() => setSelectedPlan(plan.name)}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">{plan.name}</h3>
                  {selectedPlan === plan.name && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="text-2xl font-bold mb-2">${plan.price}<span className="text-sm text-muted-foreground font-normal">/mo</span></div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-primary" />
                    {plan.websites} website{plan.websites !== 1 ? 's' : ''}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-primary" />
                    {plan.dripsPerDay} drips/day/site
                  </li>
                  <li className="flex items-center gap-2">
                    <Sparkles className="h-3 w-3 text-primary" />
                    {plan.splashesPerMonth} splash{plan.splashesPerMonth !== 1 ? 'es' : ''}/month
                  </li>
                </ul>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleCheckout}
          className="w-full"
          disabled={checkoutMutation.isPending}
        >
          {checkoutMutation.isPending ? "Processing..." : `Subscribe to ${selectedPlan}`}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default SubscriptionCard;