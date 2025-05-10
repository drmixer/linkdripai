import { ReactNode } from "react";
import Sidebar from "./sidebar";
import Header from "./header";
import { useAuth } from "@/hooks/use-auth";

interface LayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function Layout({ children, title, subtitle }: LayoutProps) {
  const { user } = useAuth();
  
  // Default subtitle only for the dashboard page
  const defaultSubtitle = title === "Dashboard" 
    ? "Here's an overview of your backlink opportunities and outreach progress."
    : "";
  
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {title && (
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  {title}
                  {user && <span className="hidden sm:inline">, {user.firstName}!</span>}
                </h1>
                {(subtitle || defaultSubtitle) && (
                  <p className="mt-1 text-sm text-gray-500">
                    {subtitle || defaultSubtitle}
                  </p>
                )}
              </div>
            )}
            
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
