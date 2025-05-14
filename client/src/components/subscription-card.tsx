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
import { SubscriptionPlan, PLAN_DETAILS } from '@/lib/subscription-plans';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface SubscriptionCardProps {
  tier: SubscriptionPlan;
  popular?: boolean;
  className?: string;
}

const SubscriptionCard = ({
  tier,
  popular = false,
  className = '',
}: SubscriptionCardProps) => {
  const { user } = useAuth();
  const plan = PLAN_DETAILS[tier];
  
  const isCurrentPlan = user?.subscription?.toLowerCase() === tier.toLowerCase();
  
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
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <CardDescription>
          {plan.description}
        </CardDescription>
        <div className="mt-2">
          <span className="text-3xl font-bold">${plan.price}</span>
          <span className="text-muted-foreground">/mo</span>
        </div>
      </CardHeader>

      <CardContent className="flex-grow">
        <ul className="space-y-2">
          {plan.features.map((feature, index) => (
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
            planId={tier}
            buttonText={`Upgrade to ${plan.name}`}
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