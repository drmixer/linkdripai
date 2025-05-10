import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertCircle, Check, Droplet } from "lucide-react";
import { cn } from "@/lib/utils";

interface BuySplashesDialogProps {
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function BuySplashesDialog({
  trigger,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
}: BuySplashesDialogProps) {
  const { toast } = useToast();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  
  // If open prop is provided, use it (controlled component), otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const [splashCount, setSplashCount] = useState<number>(1);
  
  // Splash price is $3 each
  const SPLASH_PRICE = 3;
  const totalPrice = splashCount * SPLASH_PRICE;

  // Add splashes mutation
  const addSplashesMutation = useMutation({
    mutationFn: async (splashes: string) => {
      const res = await apiRequest("POST", "/api/splashes/add", { splashes: parseInt(splashes) });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      handleOpenChange(false);
      toast({
        title: "Splashes added",
        description: `${splashCount} ${splashCount === 1 ? 'splash has' : 'splashes have'} been added to your account.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add splashes",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    // Only update internal state if we're not controlled
    if (controlledOpen === undefined) {
      setUncontrolledOpen(newOpen);
    }
    
    if (onOpenChange) {
      onOpenChange(newOpen);
    }
  };

  const handleAddSplashes = () => {
    addSplashesMutation.mutate(splashCount.toString());
  };
  
  const incrementSplash = () => {
    setSplashCount(prev => prev + 1);
  };
  
  const decrementSplash = () => {
    setSplashCount(prev => Math.max(1, prev - 1));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Purchase Additional Splashes</DialogTitle>
          <DialogDescription>
            Splashes give you immediate access to more fresh opportunities beyond your daily drips. Each splash triggers our AI to find relevant backlink opportunities for your website right away.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="space-y-4">
            <Label>Select Splash Quantity ($3 each)</Label>
            <div className="border rounded-lg p-6">
              <div className="flex flex-col items-center justify-between">
                <div className="flex items-center space-x-6 mb-6">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={decrementSplash}
                    disabled={splashCount <= 1}
                    className="h-10 w-10 rounded-full"
                  >
                    <svg width="15" height="2" viewBox="0 0 15 2" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1.16699 1H13.8337" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Button>
                  
                  <div className="flex flex-col items-center">
                    <div className="text-4xl font-semibold text-gray-900">{splashCount}</div>
                    <div className="text-sm text-gray-500">Splash{splashCount > 1 ? 'es' : ''}</div>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={incrementSplash}
                    className="h-10 w-10 rounded-full"
                  >
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7.5 1V14M1 7.5H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Button>
                </div>
                
                <div className="w-full border-t pt-4 mt-2">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-500">Total Cost:</div>
                    <div className="text-xl font-semibold text-gray-900">${totalPrice}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleAddSplashes}
            disabled={addSplashesMutation.isPending}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          >
            {addSplashesMutation.isPending && (
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            )}
            Purchase Splashes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}