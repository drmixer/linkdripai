/**
 * Subscription Card Component
 * 
 * This component displays subscription plan details and a checkout button
 * for a particular plan tier (Starter, Grow, Pro).
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';
import CheckoutButton from './checkout-button';
import { SubscriptionPlan, subscriptionPlans } from '@/lib/subscription-plans';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface SubscriptionCardProps {
  plan: SubscriptionPlan;
  price: number;
  features: string[];
  current?: boolean;
  popular?: boolean;
  className?: string;
}

const SubscriptionCard = ({
  plan,
  price,
  features,
  current = false,
  popular = false,
  className = '',
}: SubscriptionCardProps) => {
  const { user } = useAuth();
  const planDetails = subscriptionPlans.find(p => p.enum === plan);
  
  const isCurrentPlan = current || (user?.subscription?.toLowerCase() === plan.toLowerCase());
  
  return (
    <Card className={cn(
      'flex flex-col',
      popular ? 'border-primary shadow-lg' : '',
      className
    )}>
      <CardHeader>
        {popular && (
          <Badge variant="secondary" className="w-fit mb-2">
            Most Popular
          </Badge>
        )}
        <CardTitle className="text-xl">{planDetails?.name || String(plan)}</CardTitle>
        <CardDescription>
          {planDetails?.description || "Subscription plan"}
        </CardDescription>
        <div className="mt-2">
          <span className="text-3xl font-bold">${price}</span>
          <span className="text-muted-foreground">/mo</span>
        </div>
      </CardHeader>

      <CardContent className="flex-grow">
        <ul className="space-y-2">
          {features.map((feature: string, index: number) => (
            <li key={index} className="flex items-start">
              <Check className="h-5 w-5 text-primary flex-shrink-0 mr-2" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        {isCurrentPlan ? (
          <Button disabled className="w-full">
            Current Plan
          </Button>
        ) : (
          <CheckoutButton
            planId={plan}
            buttonText={`Upgrade to ${planDetails?.name || String(plan)}`}
            fullWidth={true}
            variant={popular ? 'default' : 'outline'}
            className="font-semibold"
            onSuccessRedirect="/account"
          />
        )}
      </CardFooter>
    </Card>
  );
};

export { SubscriptionCard };