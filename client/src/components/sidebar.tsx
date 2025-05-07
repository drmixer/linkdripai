import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { HomeIcon, Link2Icon, FolderIcon, MailIcon, BarChart2Icon, SlidersIcon, UserCogIcon, GlobeIcon, CreditCardIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const initials = user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}` : 'U';
  const planType = user?.subscription || 'Free Trial';

  const routes = [
    {
      label: "Dashboard",
      icon: HomeIcon,
      href: "/",
    },
    {
      label: "Daily Opportunities",
      icon: Link2Icon,
      href: "/opportunities",
    },
    {
      label: "Saved Prospects",
      icon: FolderIcon,
      href: "/saved-prospects",
    },
    {
      label: "Email Outreach",
      icon: MailIcon,
      href: "/email-outreach",
    },
    {
      label: "Analytics",
      icon: BarChart2Icon,
      href: "/analytics",
    },
  ];

  const settingsRoutes = [
    {
      label: "Preferences",
      icon: SlidersIcon,
      href: "/preferences",
    },
    {
      label: "Account Settings",
      icon: UserCogIcon,
      href: "/account",
    },
    {
      label: "Manage Websites",
      icon: GlobeIcon,
      href: "/websites",
    },
    {
      label: "Billing & Credits",
      icon: CreditCardIcon,
      href: "/billing",
    },
  ];

  const SidebarContent = () => (
    <>
      <div className="flex items-center justify-center h-16 px-4 border-b border-gray-200">
        <div className="flex items-center">
          <div className="rounded-md bg-primary p-1.5 mr-2">
            <Link2Icon className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">LinkSyncOS</span>
        </div>
      </div>
            
      <div className="flex flex-col flex-1 px-3 py-4 space-y-1">
        <div className="px-3 pb-2">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Main</p>
        </div>
        {routes.map((route) => (
          <Link 
            key={route.href} 
            href={route.href}
            onClick={() => setOpen(false)}
          >
            <a className={cn(
              "flex items-center px-3 py-2 text-sm font-medium rounded-md",
              location === route.href 
                ? "bg-primary-50 text-primary-700" 
                : "text-gray-700 hover:bg-gray-100"
            )}>
              <route.icon className="h-5 w-5 mr-3" />
              {route.label}
            </a>
          </Link>
        ))}

        <div className="px-3 pt-5 pb-2">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Settings</p>
        </div>
        {settingsRoutes.map((route) => (
          <Link 
            key={route.href} 
            href={route.href}
            onClick={() => setOpen(false)}
          >
            <a className={cn(
              "flex items-center px-3 py-2 text-sm font-medium rounded-md",
              location === route.href 
                ? "bg-primary-50 text-primary-700" 
                : "text-gray-700 hover:bg-gray-100"
            )}>
              <route.icon className="h-5 w-5 mr-3" />
              {route.label}
            </a>
          </Link>
        ))}
      </div>

      <div className="mx-3 my-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <span className="text-sm font-medium text-purple-500">{initials}</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500 truncate">{planType}</p>
            </div>
          </div>
        </div>
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
          <SheetContent side="left" className="p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
        
        <div className="flex items-center">
          <div className="rounded-md bg-primary p-1 mr-2">
            <Link2Icon className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">LinkSyncOS</span>
        </div>
      </div>
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 min-h-screen overflow-y-auto bg-white border-r border-gray-200">
        <SidebarContent />
      </aside>
    </>
  );
}
