/**
 * Checkout Button Component
 * 
 * This component creates a button that initiates a LemonSqueezy checkout session
 * for subscription plans or splash packages.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface CheckoutButtonProps {
  planId?: string;
  splashPackage?: string;
  buttonText: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  onSuccessRedirect?: string;
  fullWidth?: boolean;
}

const CheckoutButton = ({
  planId,
  splashPackage,
  buttonText,
  variant = 'default',
  size = 'default',
  className = '',
  onSuccessRedirect,
  fullWidth = false,
}: CheckoutButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  if (!planId && !splashPackage) {
    console.error('CheckoutButton requires either planId or splashPackage prop');
    return null;
  }

  const handleCheckout = async () => {
    try {
      setIsLoading(true);

      // Determine whether this is a subscription or splash package checkout
      const endpoint = planId 
        ? '/api/subscription/checkout'
        : '/api/subscription/splash-checkout';

      // Prepare the payload
      const payload = {
        planId,
        splashPackage,
        redirectUrl: onSuccessRedirect || window.location.pathname,
        email: user?.email,
        name: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
      };

      // Make the API request
      const response = await apiRequest('POST', endpoint, payload);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create checkout session');
      }

      // Redirect to the checkout URL
      window.location.href = data.checkoutUrl;
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout Error',
        description: error.message || 'Failed to initiate checkout.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={`${className} ${fullWidth ? 'w-full' : ''}`}
      onClick={handleCheckout}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        buttonText
      )}
    </Button>
  );
};

export default CheckoutButton;