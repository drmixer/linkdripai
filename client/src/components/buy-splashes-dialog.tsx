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
  const [selectedSplashes, setSelectedSplashes] = useState<string>("3");

  // Splash packages
  const splashPackages = [
    { value: "3", label: "3 Splashes", price: "$9" },
    { value: "5", label: "5 Splashes", price: "$14" },
    { value: "10", label: "10 Splashes", price: "$25" },
    { value: "20", label: "20 Splashes", price: "$45" },
  ];

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
        description: `${selectedSplashes} splashes have been added to your account.`,
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
    addSplashesMutation.mutate(selectedSplashes);
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
            <Label>Select Splash Package</Label>
            <div className="grid grid-cols-1 gap-3">
              {splashPackages.map((pkg) => (
                <div 
                  key={pkg.value}
                  className={cn(
                    "border rounded-lg p-4 cursor-pointer transition-colors",
                    selectedSplashes === pkg.value 
                      ? "border-primary bg-primary-50" 
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => setSelectedSplashes(pkg.value)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={cn(
                        "w-5 h-5 rounded-full border flex items-center justify-center mr-3",
                        selectedSplashes === pkg.value 
                          ? "border-primary bg-primary text-white" 
                          : "border-gray-300"
                      )}>
                        {selectedSplashes === pkg.value && <Check className="h-3 w-3" />}
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