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
import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface BuyCreditsDialogProps {
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function BuyCreditsDialog({
  trigger,
  defaultOpen = false,
  onOpenChange,
}: BuyCreditsDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(defaultOpen);
  const [selectedCredits, setSelectedCredits] = useState<string>("50");

  // Credit packages
  const creditPackages = [
    { value: "50", label: "50 Credits", price: "$19" },
    { value: "100", label: "100 Credits", price: "$29" },
    { value: "200", label: "200 Credits", price: "$49" },
    { value: "500", label: "500 Credits", price: "$99" },
  ];

  // Add credits mutation
  const addCreditsMutation = useMutation({
    mutationFn: async (credits: string) => {
      const res = await apiRequest("POST", "/api/credits/add", { credits: parseInt(credits) });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      handleOpenChange(false);
      toast({
        title: "Credits added",
        description: `${selectedCredits} credits have been added to your account.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add credits",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (onOpenChange) {
      onOpenChange(newOpen);
    }
  };

  const handleAddCredits = () => {
    addCreditsMutation.mutate(selectedCredits);
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
          <DialogTitle>Purchase Additional Credits</DialogTitle>
          <DialogDescription>
            Credits are used to unlock prospect information. These credits never expire.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="space-y-4">
            <Label>Select Credit Package</Label>
            <div className="grid grid-cols-1 gap-3">
              {creditPackages.map((pkg) => (
                <div 
                  key={pkg.value}
                  className={cn(
                    "border rounded-lg p-4 cursor-pointer transition-colors",
                    selectedCredits === pkg.value 
                      ? "border-primary bg-primary-50" 
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => setSelectedCredits(pkg.value)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={cn(
                        "w-5 h-5 rounded-full border flex items-center justify-center mr-3",
                        selectedCredits === pkg.value 
                          ? "border-primary bg-primary text-white" 
                          : "border-gray-300"
                      )}>
                        {selectedCredits === pkg.value && <Check className="h-3 w-3" />}
                      </div>
                      <div>
                        <div className="font-medium">{pkg.label}</div>
                        <div className="text-sm text-gray-500">One-time purchase</div>
                      </div>
                    </div>
                    <div className="font-medium">{pkg.price}</div>
                  </div>
                </div>
              ))}
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
            onClick={handleAddCredits}
            disabled={addCreditsMutation.isPending}
          >
            {addCreditsMutation.isPending && (
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            )}
            Purchase Credits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}