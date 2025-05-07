import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  progressValue?: number;
  progressColor?: string;
  additionalInfo?: {
    label: string;
    value: string;
    isPositive?: boolean;
  };
}

export default function StatCard({
  title,
  value,
  icon,
  iconBgColor = "bg-blue-100",
  iconColor = "text-primary-600",
  progressValue,
  progressColor = "bg-primary-500",
  additionalInfo,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-5 border border-gray-200">
      <div className="flex items-center">
        <div className={cn("flex-shrink-0 rounded-md p-3", iconBgColor)}>
          <div className={cn("h-6 w-6", iconColor)}>{icon}</div>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
      
      {progressValue !== undefined && (
        <div className="mt-3">
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div 
              className={cn("h-2.5 rounded-full", progressColor)} 
              style={{ width: `${progressValue}%` }}
            ></div>
          </div>
        </div>
      )}
      
      {additionalInfo && (
        <div className="mt-3">
          <div className="flex items-center">
            <span className="text-xs text-gray-500">{additionalInfo.label}</span>
            <span className={cn(
              "ml-auto text-xs flex items-center",
              additionalInfo.isPositive ? "text-green-600" : "text-red-600"
            )}>
              {additionalInfo.isPositive && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              )}
              {!additionalInfo.isPositive && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
              {additionalInfo.value}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
