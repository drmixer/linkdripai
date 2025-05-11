import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { 
  HomeIcon, 
  Link2Icon, 
  MailIcon, 
  GlobeIcon, 
  CreditCardIcon, 
  HelpCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusCircleIcon,
  LineChartIcon,
  UnlockIcon
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const routes = [
    {
      label: "Dashboard",
      icon: HomeIcon,
      href: "/dashboard",
    },
    {
      label: "Opportunities",
      icon: UnlockIcon,
      href: "/opportunities",
    },
    {
      label: "Outreach",
      icon: MailIcon,
      href: "/email-outreach",
    },
    {
      label: "Analytics",
      icon: LineChartIcon,
      href: "/analytics",
    },
    {
      label: "Sites",
      icon: GlobeIcon,
      href: "/websites",
    },
    {
      label: "Billing & Add-ons",
      icon: CreditCardIcon,
      href: "/billing",
    },
    {
      label: "Help Center",
      icon: HelpCircleIcon,
      href: "/help",
    },
  ];

  const SidebarContent = () => (
    <>
      {/* Only show logo in mobile sidebar or when desktop sidebar is expanded */}
      {(!collapsed || open) && (
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <div className="flex items-center">
            <div className="rounded-md bg-primary-600 p-1.5 mr-2">
              <Link2Icon className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">LinkDripAI</span>
          </div>
        </div>
      )}
            
      <div className="flex flex-col flex-1 p-3 space-y-1">
        {routes.map((route) => (
          collapsed ? (
            <TooltipProvider key={route.href}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="mx-auto">
                    <Link href={route.href}>
                      <div 
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center justify-center p-2 rounded-md cursor-pointer",
                          location === route.href 
                            ? "bg-primary-50 text-primary-700" 
                            : "text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        <route.icon className="h-5 w-5" />
                      </div>
                    </Link>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {route.label}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Link 
              key={route.href} 
              href={route.href}
            >
              <div 
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer",
                  location === route.href 
                    ? "bg-primary-50 text-primary-700" 
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <route.icon className="h-5 w-5 mr-3 flex-shrink-0" />
                {route.label}
              </div>
            </Link>
          )
        ))}
      </div>

      <div className="p-3 mt-auto">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full flex justify-center items-center text-gray-500 hover:text-gray-900"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRightIcon className="h-5 w-5" /> : <ChevronLeftIcon className="h-5 w-5" />}
          {!collapsed && <span className="ml-2">Collapse</span>}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-10 flex items-center h-16 px-4 bg-white border-b border-gray-200">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <SidebarContent />
          </SheetContent>
        </Sheet>
        
        <div className="flex items-center">
          <div className="rounded-md bg-primary-600 p-1 mr-2">
            <Link2Icon className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">LinkDripAI</span>
        </div>
      </div>
      
      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "hidden md:flex md:flex-col md:min-h-screen overflow-y-auto bg-white border-r border-gray-200 transition-all duration-300 ease-in-out",
          collapsed ? "md:w-16" : "md:w-64"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
