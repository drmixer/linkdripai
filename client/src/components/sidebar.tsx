import { Link, useLocation } from "wouter";
import {
  BarChart,
  HomeIcon,
  Mail,
  Network,
  Search,
  Settings,
  Sparkles,
  User,
  Workflow
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  
  const navItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: HomeIcon,
      active: location === "/dashboard"
    },
    {
      title: "Opportunities",
      href: "/opportunities",
      icon: Search,
      active: location.includes("/opportunit")
    },
    {
      title: "Outreach",
      href: "/outreach",
      icon: Mail,
      active: location.includes("/outreach")
    },
    {
      title: "Websites",
      href: "/websites",
      icon: Network,
      active: location.includes("/website")
    },
    {
      title: "Analytics",
      href: "/analytics",
      icon: BarChart,
      active: location.includes("/analytics")
    },
    {
      title: "Automations",
      href: "/automations",
      icon: Workflow,
      active: location.includes("/automation")
    },
    {
      title: "Splash",
      href: "/splash",
      icon: Sparkles,
      active: location.includes("/splash")
    },
    {
      title: "Account",
      href: "/account",
      icon: User,
      active: location.includes("/account")
    },
    {
      title: "Settings",
      href: "/settings",
      icon: Settings,
      active: location.includes("/settings")
    }
  ];

  return (
    <aside className="fixed left-0 top-0 z-20 hidden h-screen w-64 flex-col border-r bg-background px-3 py-4 md:flex">
      <div className="flex items-center mb-6 pl-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary mr-2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        <span className="text-xl font-bold">LinkDripAI</span>
      </div>
      
      <div className="space-y-1">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button
              variant={item.active ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "w-full justify-start text-sm font-medium",
                item.active ? "bg-secondary" : "hover:bg-secondary/70"
              )}
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.title}
            </Button>
          </Link>
        ))}
      </div>
      
      <div className="mt-auto pt-4 border-t">
        <div className="flex items-center p-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-2 text-primary">
            {user?.username ? user.username.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="text-sm">
            <p className="font-medium">{user?.username || "User"}</p>
            <p className="text-xs text-muted-foreground">{user?.email || "user@example.com"}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}