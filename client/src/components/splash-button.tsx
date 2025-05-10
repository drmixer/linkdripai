import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Droplet } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import BuySplashesDialog from "./buy-splashes-dialog";

interface SplashButtonProps {
  websiteId?: number;
  onSuccess?: (data: any) => void;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export default function SplashButton({
  websiteId,
  onSuccess,
  className = "",
  size = "default",
  variant = "default"
}: SplashButtonProps) {
  const { toast } = useToast();
  const [showBuyDialog, setShowBuyDialog] = useState(false);

  // Splash mutation
  const splashMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/splash", { 
        websiteId: websiteId || null 
      });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prospects/daily"] });
      
      toast({
        title: "Splash successful!",
        description: `New opportunities have been added to your dashboard.`,
      });
      
      if (onSuccess) {
        onSuccess(data);
      }
    },
    onError: (error: Error) => {
      // Check if error is due to no splashes left
      if (error.message.includes("No Splashes available")) {
        setShowBuyDialog(true);
      } else {
        toast({
          title: "Splash failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const handleSplash = () => {
    splashMutation.mutate();
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              onClick={handleSplash} 
              disabled={splashMutation.isPending}
              size={size}
              variant={variant}
              className={`bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white ${className}`}
            >
              {splashMutation.isPending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></div>
              ) : (
                <Droplet className="h-4 w-4 mr-2" />
              )}
              Splash
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Use a Splash to find new backlink opportunities immediately</p>
            <p className="text-xs text-gray-400 mt-1">You can get more splashes from your dashboard</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <BuySplashesDialog 
        open={showBuyDialog} 
        onOpenChange={(open) => setShowBuyDialog(open)} 
      />
    </>
  );
}