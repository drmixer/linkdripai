import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SimpleCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  size?: "sm" | "md";
  disabled?: boolean;
}

export function SimpleCheckbox({ 
  checked, 
  onChange, 
  className, 
  size = "md", 
  disabled = false 
}: SimpleCheckboxProps) {
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };
  
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded border transition-colors",
        size === "sm" ? "h-4 w-4" : "h-5 w-5",
        checked 
          ? "bg-primary-600 border-primary-600 hover:bg-primary-700 hover:border-primary-700" 
          : "bg-white border-gray-300 hover:border-gray-400",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className
      )}
      onClick={handleClick}
      role="checkbox"
      aria-checked={checked}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          onChange(!checked);
        }
      }}
    >
      {checked && <Check className={size === "sm" ? "h-2.5 w-2.5 text-white" : "h-3.5 w-3.5 text-white"} />}
    </div>
  );
}