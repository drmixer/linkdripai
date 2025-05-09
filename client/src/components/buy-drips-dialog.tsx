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

interface BuyDripsDialogProps {
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function BuyDripsDialog({
  trigger,
  defaultOpen = false,
  onOpenChange,
}: BuyDripsDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(defaultOpen);
  const [selectedDrips, setSelectedDrips] = useState<string>("10");

  // Drip (opportunity) packages
  const dripPackages = [
    { value: "10", label: "10 Daily Opportunities", price: "$15/month" },
    { value: "25", label: "25 Daily Opportunities", price: "$30/month" },
    { value: "50", label: "50 Daily Opportunities", price: "$50/month" },
  ];

  // Add drips (opportunities) mutation
  const addDripsMutation = useMutation({
    mutationFn: async (drips: string) => {
      const res = await apiRequest("POST", "/api/drips/add", { drips: parseInt(drips) });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      handleOpenChange(false);
      toast({
        title: "Opportunities added",
        description: `${selectedDrips} additional daily opportunities have been added to your account.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add opportunities",
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

  const handleAddDrips = () => {
    addDripsMutation.mutate(selectedDrips);
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
          <DialogTitle>Add Daily Opportunities</DialogTitle>
          <DialogDescription>
            Increase your daily opportunity limit with add-on packages.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="space-y-4">
            <Label>Select Opportunities Package</Label>
            <div className="grid grid-cols-1 gap-3">
              {dripPackages.map((pkg) => (
                <div 
                  key={pkg.value}
                  className={cn(
                    "border rounded-lg p-4 cursor-pointer transition-colors",
                    selectedDrips === pkg.value 
                      ? "border-primary bg-primary-50" 
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => setSelectedDrips(pkg.value)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={cn(
                        "w-5 h-5 rounded-full border flex items-center justify-center mr-3",
                        selectedDrips === pkg.value 
                          ? "border-primary bg-primary text-white" 
                          : "border-gray-300"
                      )}>
                        {selectedDrips === pkg.value && <Check className="h-3 w-3" />}
                      </div>
                      <div>
                        <div className="font-medium">{pkg.label}</div>
                        <div className="text-sm text-gray-500">Additional daily limit</div>
                      </div>
                    </div>
                    <div className="font-medium">{pkg.price}</div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-yellow-50 border border-yellow-100 rounded-md p-4 text-yellow-800 text-sm flex items-start mt-4">
              <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                This is a recurring monthly charge that will be added to your subscription. Your daily opportunity limit will be immediately increased.
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
            onClick={handleAddDrips}
            disabled={addDripsMutation.isPending}
          >
            {addDripsMutation.isPending && (
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            )}
            Add Opportunities
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}