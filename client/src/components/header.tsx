import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  CreditCard, 
  BellIcon, 
  Settings, 
  HelpCircle, 
  LogOut, 
  CreditCardIcon,
  Plus,
} from "lucide-react";
import BuyCreditsDialog from "./buy-credits-dialog";
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

export default function Header() {
  const { user, logoutMutation } = useAuth();
  const [selectedWebsite, setSelectedWebsite] = useState<string>("");
  const [websites, setWebsites] = useState<Array<{id: number, name: string, url: string}>>([]);
  
  // Effects for simulation - would be replaced with real data
  useEffect(() => {
    // Simulate websites based on plan
    const planWebsites = {
      'Starter': [{id: 1, name: "My Website", url: "mywebsite.com"}],
      'Grow': [
        {id: 1, name: "My Website", url: "mywebsite.com"},
        {id: 2, name: "My Blog", url: "myblog.com"}
      ],
      'Pro': [
        {id: 1, name: "My Website", url: "mywebsite.com"},
        {id: 2, name: "My Blog", url: "myblog.com"},
        {id: 3, name: "My Shop", url: "myshop.com"},
        {id: 4, name: "My Portfolio", url: "myportfolio.com"},
        {id: 5, name: "My Magazine", url: "mymagazine.com"}
      ],
      'Free Trial': [{id: 1, name: "My Website", url: "mywebsite.com"}]
    };
    
    const planName = user?.subscription || 'Free Trial';
    const userWebsites = planWebsites[planName as keyof typeof planWebsites] || planWebsites['Free Trial'];
    
    setWebsites(userWebsites);
    if (userWebsites.length > 0 && !selectedWebsite) {
      setSelectedWebsite(userWebsites[0].url);
    }
  }, [user]);
  

  
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleWebsiteChange = (url: string) => {
    setSelectedWebsite(url);
  };

  const initials = user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}` : 'U';
  const credits = user?.credits || 0;
  const planName = user?.subscription || 'Free Trial';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-white border-b border-gray-200">
      {/* Left section with website selector */}
      <div className="flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-9 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
              <span className="max-w-[180px] truncate">{selectedWebsite}</span>
              <svg className="ml-2 -mr-0.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Select Website</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {websites.map(site => (
              <DropdownMenuItem 
                key={site.id} 
                onClick={() => handleWebsiteChange(site.url)}
                className={cn("cursor-pointer", selectedWebsite === site.url && "bg-primary-50")}
              >
                <div className="flex items-center w-full">
                  <div className="h-6 w-6 mr-2 rounded bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                    {site.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 truncate">{site.url}</span>
                </div>
              </DropdownMenuItem>
            ))}
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
        {/* Credits */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="hidden md:flex items-center px-3 py-1.5 bg-gray-100 rounded-lg">
                <CreditCardIcon className="h-4 w-4 text-gray-500 mr-1.5" />
                <span className="text-sm font-medium text-gray-900">{credits} credits</span>
                <BuyCreditsDialog
                  trigger={
                    <Button variant="link" className="h-auto p-0 ml-1.5 text-primary-600 text-xs">
                      Buy
                    </Button>
                  }
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Credits are used to unlock opportunities</p>
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
              <Link href="/account" className="flex cursor-pointer">
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
    </header>
  );
}
