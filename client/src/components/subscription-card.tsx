import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { SplashPackage } from '@/lib/splash-packages';
import { CheckIcon, CreditCard, GlobeIcon, MailIcon, Zap, Loader2 } from 'lucide-react';

interface SubscriptionCardProps {
  className?: string;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  websites: number;
  dripsPerDay: number;
  splashesPerMonth: number;
}

export function SubscriptionCard({ className }: SubscriptionCardProps) {
  const { toast } = useToast();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Get available subscription plans
  const { data: plansData, isLoading: plansLoading } = useQuery<{ plans: Plan[] }>({
    queryKey: ['/api/subscription/plans'],
    staleTime: Infinity, // Plans rarely change
  });

  // Get current subscription details
  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['/api/subscription/subscription'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Current plan details
  const currentPlan = subscriptionData?.subscription?.plan || 'Free Trial';
  const isSubscriptionActive = subscriptionData?.subscription?.isActive || false;

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await apiRequest('POST', '/api/subscription/checkout/subscription', { planId });
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank');
        
        toast({
          title: 'Checkout Started',
          description: 'We\'ve opened the checkout page in a new tab.',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create checkout',
        variant: 'destructive',
      });
    },
  });

  // Initialize selectedPlanId when plans load
  useEffect(() => {
    if (plansData?.plans && !selectedPlanId) {
      // Find the user's current plan
      const current = plansData.plans.find(
        plan => plan.name.toLowerCase() === currentPlan.toLowerCase()
      );
      
      // Set to current plan or first plan
      setSelectedPlanId(current?.id || plansData.plans[0]?.id);
    }
  }, [plansData, currentPlan, selectedPlanId]);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
  };

  const handleSubscribe = () => {
    if (selectedPlanId) {
      checkoutMutation.mutate(selectedPlanId);
    }
  };

  if (plansLoading || subscriptionLoading) {
    return (
      <div className={`flex items-center justify-center h-72 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const plans = plansData?.plans || [];
  
  return (
    <div className={`space-y-8 ${className}`}>
      <div>
        <h2 className="text-2xl font-bold">Subscription Plans</h2>
        <p className="text-muted-foreground">
          Choose the perfect plan for your backlink outreach needs
        </p>
      </div>
      
      {isSubscriptionActive && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <CheckIcon className="h-5 w-5 text-primary" />
            <p className="font-medium text-primary-900">
              You're currently on the <span className="font-bold">{currentPlan}</span> plan.
            </p>
          </div>
          <p className="mt-2 text-sm text-primary-800">
            You can upgrade your plan at any time. Downgrading will take effect at the end of your current billing period.
          </p>
        </div>
      )}
      
      <RadioGroup value={selectedPlanId || ''} onValueChange={handleSelectPlan} className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrentPlan = plan.name.toLowerCase() === currentPlan.toLowerCase();
          
          return (
            <div key={plan.id} className="relative">
              {isCurrentPlan && (
                <Badge className="absolute -top-2 -right-2 z-10 bg-primary text-white">
                  Current Plan
                </Badge>
              )}
              <Label
                htmlFor={plan.id}
                className="cursor-pointer"
              >
                <Card className={`border-2 h-full ${selectedPlanId === plan.id ? 'border-primary' : 'border-border'}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>
                      {plan.name === 'Starter' && 'For solo marketers'}
                      {plan.name === 'Grow' && 'Popular choice for small teams'}
                      {plan.name === 'Pro' && 'Best for agencies & professionals'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="text-3xl font-bold">
                      ${plan.price}
                      <span className="text-sm font-normal text-muted-foreground">/month</span>
                    </div>
                    
                    <ul className="mt-4 space-y-2">
                      <li className="flex items-center gap-2">
                        <GlobeIcon className="h-4 w-4 text-primary" />
                        <span>{plan.websites} website{plan.websites > 1 ? 's' : ''}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <MailIcon className="h-4 w-4 text-primary" />
                        <span>Up to {plan.dripsPerDay} drips/day/site</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        <span>{plan.splashesPerMonth} premium opportunities/month</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckIcon className="h-4 w-4 text-primary" />
                        <span>{plan.name === 'Pro' ? 'Full' : plan.name === 'Grow' ? 'Advanced' : 'Basic'} filters</span>
                      </li>
                    </ul>
                  </CardContent>
                  <CardFooter className="pt-2">
                    <RadioGroupItem
                      value={plan.id}
                      id={plan.id}
                      className="hidden"
                    />
                  </CardFooter>
                </Card>
              </Label>
            </div>
          );
        })}
      </RadioGroup>
      
      <div className="flex justify-end">
        <Button 
          onClick={handleSubscribe} 
          disabled={!selectedPlanId || checkoutMutation.isPending}
          className="w-full md:w-auto"
          size="lg"
        >
          {checkoutMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              {isSubscriptionActive ? 'Change Plan' : 'Subscribe Now'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}