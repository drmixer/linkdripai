import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SimpleCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function SimpleCheckbox({ checked, onChange, className }: SimpleCheckboxProps) {
  return (
    <div
      className={cn(
        "h-5 w-5 flex items-center justify-center rounded-sm border-2 cursor-pointer",
        checked ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300",
        className
      )}
      onClick={() => onChange(!checked)}
    >
      {checked && <Check className="h-3 w-3 text-white" />}
    </div>
  );
}