/**
 * Simple Splash Button Component
 * 
 * A streamlined implementation of the splash button functionality
 * that shows either a website selection dialog or confirmation dialog
 * based on the user's available websites and splash credits.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Globe, Loader2 } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface SimpleSplashButtonProps {
  websites: any[];
  remainingSplashes: number;
  totalSplashes: number;
  onSplashUsed?: () => void;
}

export default function SimpleSplashButton({
  websites = [],
  remainingSplashes = 0,
  totalSplashes = 0,
  onSplashUsed
}: SimpleSplashButtonProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isWebsiteDialogOpen, setIsWebsiteDialogOpen] = useState(false);
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);
  const [selectedWebsite, setSelectedWebsite] = useState<{id: number, url: string} | null>(null);

  // Handle splash button click
  const handleSplashClick = () => {
    console.log("Splash button clicked, websites:", websites.length);
    
    // No splashes available, show toast message
    if (remainingSplashes <= 0) {
      toast({
        title: "No Splash credits",
        description: "You don't have any Splash credits available. Purchase Splash credits to get premium opportunities.",
        variant: "destructive",
      });
      return;
    }
    
    // Only one website, select it automatically and show confirmation
    if (websites.length === 1) {
      setSelectedWebsite(websites[0]);
      setIsConfirmationDialogOpen(true);
    } 
    // Multiple websites, show selection dialog
    else if (websites.length > 1) {
      setIsWebsiteDialogOpen(true);
    }
    // No websites, show error
    else {
      toast({
        title: "No websites found",
        description: "Please add a website before using Splash.",
        variant: "destructive",
      });
    }
  };

  // Handle website selection
  const handleWebsiteSelect = (website: any) => {
    console.log("Selected website:", website.url);
    setSelectedWebsite(website);
    setIsWebsiteDialogOpen(false);
    setIsConfirmationDialogOpen(true);
  };

  // Handle splash confirmation (actually use the splash)
  const handleConfirmSplash = async () => {
    if (!selectedWebsite) return;
    
    setIsLoading(true);
    
    try {
      console.log("Using splash for website:", selectedWebsite.url);
      const response = await apiRequest('POST', '/api/opportunities/splash', { 
        websiteId: selectedWebsite.id 
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get premium opportunity');
      }
      
      const data = await response.json();
      
      // Update queries that depend on this data
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/plan'] });
      
      toast({
        title: 'Premium opportunity added!',
        description: 'A new high-quality opportunity has been added to your feed.',
      });
      
      // Close dialog
      setIsConfirmationDialogOpen(false);
      
      // Call onSplashUsed callback if provided
      if (onSplashUsed) {
        onSplashUsed();
      }
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
    <>
      {/* Main Splash Button */}
      <Button 
        className="bg-blue-600 hover:bg-blue-700 text-white"
        onClick={handleSplashClick}
      >
        <Sparkles className="h-4 w-4 mr-2" />
        Use Splash {remainingSplashes > 0 && `(${remainingSplashes})`}
      </Button>

      {/* Website Selection Dialog */}
      <Dialog open={isWebsiteDialogOpen} onOpenChange={setIsWebsiteDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Sparkles className="h-5 w-5 text-amber-500 mr-2" />
              Select Website for Splash
            </DialogTitle>
            <DialogDescription>
              Choose which website you want to get premium opportunities for.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="text-sm mb-4">
              <span className="font-medium">Splashes remaining:</span> {remainingSplashes} of {totalSplashes}
            </div>
            <div className="space-y-2">
              {websites.map((website: any) => (
                <Button 
                  key={website.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleWebsiteSelect(website)}
                >
                  <Globe className="mr-2 h-4 w-4" />
                  {website.url}
                </Button>
              ))}
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsWebsiteDialogOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Splash Confirmation Dialog */}
      <Dialog open={isConfirmationDialogOpen} onOpenChange={setIsConfirmationDialogOpen}>
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
              <Sparkles className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-medium">Premium Opportunity Guaranteed</p>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              DA 40+, Relevance 80%+, Spam Score &lt;2%
            </p>
            
            {selectedWebsite && (
              <div className="mt-3 pt-3 border-t border-border/40">
                <p className="text-sm flex items-center">
                  <Globe className="h-4 w-4 mr-2 text-primary" />
                  For website: <span className="font-medium ml-1">{selectedWebsite.url}</span>
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
              onClick={() => setIsConfirmationDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmSplash}
              disabled={!selectedWebsite || isLoading}
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
    </>
  );
}