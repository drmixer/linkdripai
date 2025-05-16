import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Sparkles, CheckCircle, Loader2, Globe } from 'lucide-react';

interface SplashConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: number | null;
  websiteName: string;
  remainingSplashes: number;
  totalSplashes: number;
}

export default function SplashConfirmationDialog({
  open,
  onOpenChange,
  websiteId,
  websiteName,
  remainingSplashes,
  totalSplashes
}: SplashConfirmationDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  // Handle actual splash API call
  const handleConfirmSplash = async () => {
    if (!websiteId) return;
    
    setIsLoading(true);
    
    try {
      const response = await apiRequest('POST', '/api/opportunities/splash', { 
        websiteId 
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get premium opportunity');
      }
      
      const data = await response.json();
      
      // Update queries that depend on this data
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/plan'] });
      
      toast({
        title: 'Premium opportunity added!',
        description: 'A new high-quality opportunity has been added to your feed.',
      });
      
      // Close dialog
      onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <span>Confirm Splash Usage</span>
          </DialogTitle>
          <DialogDescription>
            You're about to use 1 Splash credit to reveal a premium backlink opportunity.
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-secondary/30 p-4 rounded-md my-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <p className="text-sm font-medium">Premium Opportunity Guaranteed</p>
          </div>
          <p className="text-xs text-muted-foreground ml-6">
            DA 40+, Relevance 80%+, Spam Score &lt;2%
          </p>
          
          {websiteName && (
            <div className="mt-3 pt-3 border-t border-border/40">
              <p className="text-sm flex items-center">
                <Globe className="h-4 w-4 mr-2 text-primary" />
                For website: <span className="font-medium ml-1">{websiteName}</span>
              </p>
            </div>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground">
          You have {remainingSplashes} Splash credit{remainingSplashes !== 1 ? 's' : ''} remaining. 
          This action cannot be undone.
        </p>
        
        <DialogFooter className="flex sm:justify-between gap-3 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmSplash}
            disabled={!websiteId || isLoading}
            className="bg-amber-500 hover:bg-amber-600 text-white font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Use Splash
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}