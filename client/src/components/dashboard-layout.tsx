import { ReactNode } from "react";
import Sidebar from "./sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-0 md:ml-64 px-4 py-6 md:px-8 md:py-8">
        <main className="max-w-6xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}