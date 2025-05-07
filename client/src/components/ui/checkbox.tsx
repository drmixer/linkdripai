import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface CustomCheckboxProps extends React.HTMLAttributes<HTMLDivElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}

const Checkbox = React.forwardRef<HTMLDivElement, CustomCheckboxProps>(
  ({ className, checked = false, onCheckedChange, disabled = false, ...props }, ref) => {
    const handleClick = () => {
      if (!disabled && onCheckedChange) {
        onCheckedChange(!checked);
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-sm border-2 transition-colors",
          checked 
            ? "bg-primary-600 border-primary-600" 
            : "bg-white border-gray-300",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
          className
        )}
        onClick={handleClick}
        role="checkbox"
        aria-checked={checked}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        {...props}
      >
        {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

export { Checkbox }
