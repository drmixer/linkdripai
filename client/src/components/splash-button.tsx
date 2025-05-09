import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface SplashButtonProps {
  websiteId?: number;
  buttonText?: string;
  className?: string;
  onSuccess?: (data: any) => void;
}

export function SplashButton({ 
  websiteId, 
  buttonText = 'Get Fresh Opportunities', 
  className = '',
  onSuccess
}: SplashButtonProps) {
  const [isDisabled, setIsDisabled] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // Calculate remaining splashes
  const remainingSplashes = user ? (user.splashesAllowed || 0) - (user.splashesUsed || 0) : 0;

  const splashMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/splash', { websiteId });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Splash Success!',
        description: `${data.opportunities.length} new opportunities are now available.`,
      });
      
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/prospects/daily'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });
      
      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess(data);
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Splash Failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsDisabled(false);
    },
  });

  const handleSplash = () => {
    if (remainingSplashes <= 0) {
      toast({
        title: 'No Splashes Available',
        description: 'You have used all your Splash opportunities for this billing cycle. Upgrade your plan to get more.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsDisabled(true);
    splashMutation.mutate();
  };

  return (
    <Button
      onClick={handleSplash}
      disabled={splashMutation.isPending || isDisabled || remainingSplashes <= 0}
      className={`gap-2 ${className}`}
      variant="default"
    >
      <Sparkles className="h-4 w-4" />
      {buttonText}
      {remainingSplashes > 0 && (
        <span className="ml-1 text-xs bg-background/30 px-2 py-0.5 rounded-full">
          {remainingSplashes} left
        </span>
      )}
    </Button>
  );
}