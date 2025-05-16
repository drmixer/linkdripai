/**
 * Splash Button Component
 * 
 * This component renders a button to purchase Splash packages or use an existing Splash credit
 * to reveal a premium backlink opportunity.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Loader2 } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SplashPackage, splashPackages } from '@/lib/subscription-plans';
import CheckoutButton from './checkout-button';

interface SplashButtonProps {
  onSplashUsed?: (opportunityId: number) => void;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg';
  splashCreditsAvailable?: number;
}

const SplashButton = ({
  onSplashUsed,
  disabled = false,
  variant = 'default',
  size = 'default',
  splashCreditsAvailable,
}: SplashButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Determine if user has splash credits available
  const hasSplashCredits = (splashCreditsAvailable ?? 0) > 0;
  
  const handleUseSplash = async () => {
    setIsLoading(true);
    
    try {
      const response = await apiRequest('POST', '/api/subscription/use-splash');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to use splash credit');
      }
      
      // Update user data with new splash credit count
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      
      // If an opportunity was returned, add it to daily prospects
      if (data.opportunityId) {
        // Also invalidate the daily prospects query
        queryClient.invalidateQueries({ queryKey: ['/api/prospects/daily'] });
        
        // Notify parent component if callback provided
        if (onSplashUsed) {
          onSplashUsed(data.opportunityId);
        }
        
        toast({
          title: 'Splash Used Successfully',
          description: 'A premium opportunity has been added to your prospects!',
        });
      }
      
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error using splash:', error);
      toast({
        title: 'Error Using Splash',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          disabled={disabled}
          className="flex items-center gap-1"
        >
          <Sparkles className="h-4 w-4 mr-1" />
          Splash
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Premium Backlink Opportunities</DialogTitle>
          <DialogDescription>
            Use Splash to instantly reveal high-quality backlink opportunities (DA 40+, low spam scores).
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 space-y-4">
          {hasSplashCredits ? (
            <div className="space-y-4">
              <div className="bg-secondary/30 p-4 rounded-md">
                <p className="text-sm font-medium">
                  You have {splashCreditsAvailable} Splash credit{splashCreditsAvailable !== 1 ? 's' : ''} available
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Each Splash reveals one premium high-DA backlink opportunity with verified contact information.
                </p>
              </div>
              
              <Button 
                onClick={handleUseSplash} 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finding Premium Opportunity...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Use Splash Now
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-secondary/30 p-4 rounded-md">
                <p className="text-sm font-medium">
                  You don't have any Splash credits available
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Purchase Splash credits to instantly reveal premium backlink opportunities.
                </p>
              </div>
              
              <div className="grid gap-4 pt-2">
                {splashPackages.map((details) => {
                  return (
                    <div key={details.enum} className="flex justify-between items-center rounded-md border p-4">
                      <div>
                        <h4 className="font-medium">{details.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {details.description}
                        </p>
                        {details.savePercentage && details.savePercentage > 0 && (
                          <p className="text-xs text-green-600 font-medium mt-1">
                            Save {details.savePercentage}%
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${details.price}</p>
                        <CheckoutButton
                          splashPackage={details.enum}
                          buttonText="Buy"
                          size="sm"
                          className="mt-2"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SplashButton;