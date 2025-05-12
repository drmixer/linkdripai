import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button, ButtonProps } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Package options for buying splashes
interface SplashPackage {
  id: string;
  name: string;
  count: number;
  price: number;
  savings?: string;
}

// Premium button styling for the buy button
export function BuyButton({ children, ...props }: ButtonProps) {
  return (
    <Button variant="premium" size="sm" className="gap-2" {...props}>
      <Sparkles className="h-4 w-4" />
      {children}
    </Button>
  );
}

// Buy splashes dialog props
interface BuySplashesDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}

// Splash packages with pricing
const splashPackages: SplashPackage[] = [
  { id: "single", name: "Single Splash", count: 1, price: 7 },
  { id: "pack3", name: "3-Pack", count: 3, price: 18, savings: "Save 14%" },
  { id: "pack7", name: "7-Pack", count: 7, price: 35, savings: "Save 29%" }
];

// Buy splashes dialog component
export function BuySplashesDialog({ open = false, onOpenChange, onClose }: BuySplashesDialogProps) {
  const [selectedPackage, setSelectedPackage] = useState<string>(splashPackages[0].id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Safe function to handle dialog closing
  const handleClose = () => {
    // Always attempt to close the dialog using both methods for maximum compatibility
    if (typeof onOpenChange === 'function') {
      onOpenChange(false);
    }
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  // Mutation for purchasing splashes
  const purchaseMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const response = await apiRequest("POST", "/api/purchase-splashes", { packageId });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Purchase Successful!",
        description: `You've added ${data.count} Splashes to your account.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user-stats"] });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Get selected package details
  const getSelectedPackage = () => {
    return splashPackages.find(pkg => pkg.id === selectedPackage) || splashPackages[0];
  };

  // Handle purchase submit
  const handlePurchase = () => {
    purchaseMutation.mutate(selectedPackage);
  };

  // If the dialog is not requested to be open, don't render it at all
  if (open === false) {
    return null;
  }

  return (
    <Dialog 
      open={true} 
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Purchase Splashes
          </DialogTitle>
          <DialogDescription>
            Splashes give you instant access to premium, high-quality backlink opportunities
            (DA 40+, relevance 80%+, spam &lt;2%). Your monthly Splash allocation is shared
            across all your sites.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-5">
            <RadioGroup 
              defaultValue={selectedPackage}
              onValueChange={setSelectedPackage}
              className="space-y-3"
            >
              {splashPackages.map((pkg) => (
                <div 
                  key={pkg.id}
                  className={`
                    flex items-center justify-between space-x-2 rounded-lg border p-4 
                    ${selectedPackage === pkg.id ? 'border-primary bg-primary/5' : 'border-border'}
                  `}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={pkg.id} id={pkg.id} />
                    <Label 
                      htmlFor={pkg.id}
                      className="flex flex-col cursor-pointer"
                    >
                      <span className="font-medium">{pkg.name}</span>
                      <span className="text-xs text-muted-foreground">
                        Get {pkg.count} high-quality opportunit{pkg.count > 1 ? 'ies' : 'y'} (DA 40+)
                      </span>
                    </Label>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-medium">${pkg.price}</span>
                    {pkg.savings && (
                      <span className="text-xs text-green-600">{pkg.savings}</span>
                    )}
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            className="sm:w-auto w-full"
          >
            Cancel
          </Button>
          <BuyButton 
            onClick={handlePurchase}
            disabled={purchaseMutation.isPending}
            className="sm:w-auto w-full"
          >
            {purchaseMutation.isPending ? "Processing..." : `Buy ${getSelectedPackage().count} Splash${getSelectedPackage().count > 1 ? 'es' : ''}`}
          </BuyButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Export BuySplashesDialog as the default export
export default BuySplashesDialog;