import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  CreditCard, 
  BellIcon, 
  Settings, 
  HelpCircle, 
  LogOut, 
  Droplet,
  Plus,
  Sparkles,
} from "lucide-react";
import { storeSelectedWebsiteId, getSelectedWebsiteId } from "@/lib/session-helper";
import Logo from "@/components/logo";
import SplashDialog from "@/components/splash-dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Website } from "@shared/schema";

export default function Header() {
  const { user, logoutMutation } = useAuth();
  const [selectedWebsite, setSelectedWebsite] = useState<string>("");
  const [showSplashDialog, setShowSplashDialog] = useState<boolean>(false);
  
  // Fetch user's websites from the API
  const { data: websites = [], isLoading: isLoadingWebsites } = useQuery({
    queryKey: ["/api/websites"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/websites");
      return res.json();
    },
    enabled: !!user, // Only run if user is authenticated
  });
  
  // Set website from localStorage or use first site when websites load
  useEffect(() => {
    // Look for a matching website ID in localStorage
    const storedWebsiteId = getSelectedWebsiteId();
    
    if (websites.length > 0) {
      // If we have a stored website ID, find that website in the list
      if (storedWebsiteId) {
        const storedWebsite = websites.find((site: any) => site.id === storedWebsiteId);
        if (storedWebsite) {
          setSelectedWebsite(storedWebsite.url);
          return;
        }
      }
      
      // Fall back to first website if no stored site or stored site not found
      if (!selectedWebsite) {
        setSelectedWebsite(websites[0].url);
        storeSelectedWebsiteId(websites[0].id);
      }
    } else if (websites.length === 0 && !selectedWebsite) {
      // Default placeholder when no websites are available
      setSelectedWebsite("Select a website");
    }
  }, [websites, selectedWebsite]);
  

  
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleWebsiteChange = (url: string, websiteId: number) => {
    setSelectedWebsite(url);
    storeSelectedWebsiteId(websiteId);
  };

  const initials = user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}` : 'U';
  const splashesAvailable = user?.splashesAllowed ? (user.splashesAllowed - (user.splashesUsed || 0)) : 0;
  const planName = user?.subscription || 'Free Trial';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-24 px-4 md:px-6 bg-white border-b border-gray-200">
      {/* Left section with website selector */}
      <div className="flex items-center gap-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className={cn(
                "h-9 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500",
                websites && websites.length > 0 ? "text-gray-700" : "text-gray-500"
              )}
            >
              <span className="max-w-[180px] truncate flex items-center">
                {websites && websites.length > 0 ? (
                  selectedWebsite
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add a website
                  </>
                )}
              </span>
              <svg className="ml-2 -mr-0.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Select Website</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {websites && websites.length > 0 ? (
              websites.map((site: any) => (
                <DropdownMenuItem 
                  key={site.id} 
                  onClick={() => handleWebsiteChange(site.url, site.id)}
                  className={cn("cursor-pointer", selectedWebsite === site.url && "bg-primary-50")}
                >
                  <div className="flex items-center w-full">
                    <div className="h-6 w-6 mr-2 rounded bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                      {site.url ? site.url.charAt(0).toUpperCase() : '?'}
                    </div>
                    <span className="flex-1 truncate">{site.url}</span>
                  </div>
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled className="opacity-70 cursor-not-allowed">
                <div className="flex items-center w-full">
                  <span className="text-sm text-gray-500">No websites added yet</span>
                </div>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/websites" className="w-full cursor-pointer">
                <div className="flex items-center w-full text-primary-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Manage Websites
                </div>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Center spacer */}
      <div className="flex-1"></div>

      {/* Right side actions */}
      <div className="flex items-center space-x-3">
        {/* Splashes */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="hidden md:flex items-center px-3 py-1.5 bg-primary-50 rounded-lg">
                <Sparkles className="h-4 w-4 text-blue-500 mr-1.5" />
                <span 
                  className="text-sm font-medium text-gray-900 cursor-pointer" 
                  onClick={() => {
                    if (websites.length > 0) {
                      // Redirect to drips page which will handle the splash confirmation
                      window.location.href = "/drips";
                    }
                  }}
                >
                  {splashesAvailable} Splashes
                </span>
                <Button 
                  variant="link" 
                  className="h-auto p-0 ml-1.5 text-primary-600 text-xs"
                  onClick={() => setShowSplashDialog(true)}
                >
                  Buy
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Splashes give you access to high-quality opportunities (DA 40+, relevance 80%+)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        

        

        
        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 bg-gray-200">
              <span className="sr-only">Open user menu</span>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary-100 text-primary-800 text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
              <Badge variant="outline" className="mt-1 bg-primary-50 text-primary-700 hover:bg-primary-50">
                {planName}
              </Badge>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/billing" className="flex cursor-pointer">
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Billing & Add-ons</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/help" className="flex cursor-pointer">
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>Help Center</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="flex cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Splashes Dialog */}
      <SplashDialog 
        open={showSplashDialog}
        onOpenChange={(purchased) => {
          setShowSplashDialog(false);
        }}
      />
    </header>
  );
}
