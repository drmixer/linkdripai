import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle
} from '@/components/ui/card';
import { SplashPackage, splashPackages } from '@/lib/subscription-plans';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Package, Zap, CheckIcon, Loader2 } from 'lucide-react';

interface SplashDialogProps {
  open: boolean;
  onOpenChange: (purchased: boolean) => void;
}

export default function SplashDialog({ open, onOpenChange }: SplashDialogProps) {
  const { toast } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<SplashPackage | null>(null);
  
  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async (packageId: SplashPackage) => {
      const res = await apiRequest('POST', '/api/subscription/checkout/splash', { packageId });
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank');
        onOpenChange(true);
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

  const handleBuy = () => {
    if (!selectedPackage) {
      toast({
        title: 'Please select a package',
        description: 'Select a Splash package to continue',
        variant: 'destructive',
      });
      return;
    }
    
    checkoutMutation.mutate(selectedPackage);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) onOpenChange(false);
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <span>Buy Splash Credits</span>
          </DialogTitle>
          <DialogDescription>
            Splash credits let you get premium backlink opportunities instantly (Domain Authority 40+, Spam Score &lt;2, Relevance 80%+).
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4 sm:grid-cols-3">
          <Card 
            className={`cursor-pointer hover:border-primary/50 transition-colors ${selectedPackage === SplashPackage.SINGLE ? 'border-primary' : 'border-border'}`}
            onClick={() => setSelectedPackage(SplashPackage.SINGLE)}
          >
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-xl flex items-center gap-2">
                {selectedPackage === SplashPackage.SINGLE && (
                  <CheckIcon className="h-4 w-4 text-primary" />
                )}
                <span>1 Splash</span>
              </CardTitle>
              <CardDescription>Single high-quality opportunity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">$7</div>
              <p className="text-sm text-muted-foreground">per credit</p>
            </CardContent>
            <CardFooter>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full"
                onClick={() => setSelectedPackage(SplashPackage.SINGLE)}
              >
                Select
              </Button>
            </CardFooter>
          </Card>
          
          <Card 
            className={`cursor-pointer hover:border-primary/50 transition-colors ${selectedPackage === SplashPackage.TRIPLE ? 'border-primary' : 'border-border'}`}
            onClick={() => setSelectedPackage(SplashPackage.TRIPLE)}
          >
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-xl flex items-center gap-2">
                {selectedPackage === SplashPackage.TRIPLE && (
                  <CheckIcon className="h-4 w-4 text-primary" />
                )}
                <span>3 Splashes</span>
              </CardTitle>
              <CardDescription>Popular choice</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">$18</div>
              <p className="text-sm text-muted-foreground">$6 per credit (save 14%)</p>
            </CardContent>
            <CardFooter>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full"
                onClick={() => setSelectedPackage(SplashPackage.TRIPLE)}
              >
                Select
              </Button>
            </CardFooter>
          </Card>
          
          <Card 
            className={`cursor-pointer hover:border-primary/50 transition-colors ${selectedPackage === SplashPackage.SEVEN ? 'border-primary' : 'border-border'}`}
            onClick={() => setSelectedPackage(SplashPackage.SEVEN)}
          >
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-xl flex items-center gap-2">
                {selectedPackage === SplashPackage.SEVEN && (
                  <CheckIcon className="h-4 w-4 text-primary" />
                )}
                <span>7 Splashes</span>
              </CardTitle>
              <CardDescription>Best value</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">$35</div>
              <p className="text-sm text-muted-foreground">$5 per credit (save 29%)</p>
            </CardContent>
            <CardFooter>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full"
                onClick={() => setSelectedPackage(SplashPackage.SEVEN)}
              >
                Select
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <div className="bg-muted p-4 rounded-lg">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Premium Opportunity Quality
          </h4>
          <ul className="space-y-1 text-sm">
            <li className="flex items-center gap-2">
              <CheckIcon className="h-3 w-3 text-green-500" />
              <span>Domain Authority 40+</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon className="h-3 w-3 text-green-500" />
              <span>Low Spam Score &lt;2</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon className="h-3 w-3 text-green-500" />
              <span>High Relevance 80%+</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon className="h-3 w-3 text-green-500" />
              <span>Verified Contact Information</span>
            </li>
          </ul>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleBuy}
            disabled={!selectedPackage || checkoutMutation.isPending}
          >
            {checkoutMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Buy Now'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}