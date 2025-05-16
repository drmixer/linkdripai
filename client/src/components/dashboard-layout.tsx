import { ReactNode } from "react";
import Sidebar from "./sidebar";
import SiteSelector from "./site-selector";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col w-full overflow-x-hidden">
        <div className="sticky top-0 z-30 border-b bg-background p-4 w-full ml-0 md:ml-64">
          <div className="max-w-6xl mx-auto">
            <SiteSelector />
          </div>
        </div>
        <div className="flex-1 px-4 py-6 md:px-8 md:py-8 ml-0 md:ml-64 w-auto">
          <main className="max-w-6xl mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}