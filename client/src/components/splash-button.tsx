import React, { useState } from 'react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import BuySplashesDialog from "@/components/buy-splashes-dialog";

interface SplashButtonProps {
  remainingSplashes: number;
  disabled?: boolean;
  className?: string;
  onUseSplash?: () => void;
}

export function SplashButton({ 
  remainingSplashes, 
  disabled = false, 
  className = "",
  onUseSplash 
}: SplashButtonProps) {
  const [open, setOpen] = useState(false);
  const [showBuySplashesDialog, setShowBuySplashesDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const splashMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/splashes/use', {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prospects/daily'] });
      if (onUseSplash) onUseSplash();
      toast({
        title: "Splash used successfully!",
        description: "A high-quality opportunity (DA 40+) has been added to your feed.",
        variant: "default",
      });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error using splash",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleUseSplash = () => {
    splashMutation.mutate();
  };

  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button 
            variant={remainingSplashes > 0 ? "premium" : "outline"} 
            className={`gap-2 ${className}`}
            disabled={disabled || splashMutation.isPending}
          >
            <Sparkles className="h-4 w-4" />
            <span>Splash {remainingSplashes > 0 ? `(${remainingSplashes} left)` : ""}</span>
            {splashMutation.isPending && (
              <span className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="max-w-md">
          {remainingSplashes > 0 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Use a Splash?</AlertDialogTitle>
                <AlertDialogDescription>
                  Use 1 Splash to add a premium, high-quality opportunity (DA 40+, relevance 80%+, spam &lt;2%) to your feed right now. 
                  You have {remainingSplashes} Splash{remainingSplashes !== 1 ? 'es' : ''} remaining this month across all your sites.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleUseSplash}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700"
                >
                  Use Splash
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>No Splashes Remaining</AlertDialogTitle>
                <AlertDialogDescription>
                  You've used all your monthly Splashes across your sites. Purchase additional Splashes to get more premium, high-quality opportunities (DA 40+, relevance 80%+, spam &lt;2%) instantly.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button 
                  variant="premium" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => {
                    setOpen(false);
                    setShowBuySplashesDialog(true);
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  Buy Splashes
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Buy Splashes Dialog */}
      <BuySplashesDialog 
        open={showBuySplashesDialog} 
        onOpenChange={setShowBuySplashesDialog}
      />
    </>
  );
}

// Export SplashButton as default
export default SplashButton;