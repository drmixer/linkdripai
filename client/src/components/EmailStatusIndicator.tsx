import React from 'react';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  MailOpen, 
  Send, 
  RefreshCw, 
  CheckCheck,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type EmailStatus = 
  | 'draft'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'bounced'
  | 'failed'
  | 'spam'
  | 'unsent'
  | 'unknown';

interface EmailStatusIndicatorProps {
  status: EmailStatus;
  className?: string;
  showText?: boolean;
  small?: boolean;
}

/**
 * A component that displays a visual indicator for different email statuses
 */
export function EmailStatusIndicator({ 
  status, 
  className, 
  showText = false,
  small = false 
}: EmailStatusIndicatorProps) {
  
  const iconSize = small ? 14 : 16;
  const iconClasses = small ? 'mr-1' : 'mr-2';
  
  const getStatusConfig = () => {
    switch(status) {
      case 'draft':
        return {
          icon: <Clock className={cn(iconClasses, 'text-slate-500')} size={iconSize} />,
          text: 'Draft',
          color: 'text-slate-500',
          bgColor: 'bg-slate-100',
          description: 'Email is saved as a draft and not yet queued'
        };
      case 'queued':
        return {
          icon: <Clock className={cn(iconClasses, 'text-yellow-500')} size={iconSize} />,
          text: 'Queued',
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-50',
          description: 'Email is queued for sending'
        };
      case 'sending':
        return {
          icon: <RefreshCw className={cn(iconClasses, 'text-blue-500 animate-spin')} size={iconSize} />,
          text: 'Sending',
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          description: 'Email is currently being sent'
        };
      case 'sent':
        return {
          icon: <Send className={cn(iconClasses, 'text-blue-500')} size={iconSize} />,
          text: 'Sent',
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          description: 'Email has been sent'
        };
      case 'delivered':
        return {
          icon: <CheckCircle className={cn(iconClasses, 'text-green-500')} size={iconSize} />,
          text: 'Delivered',
          color: 'text-green-500',
          bgColor: 'bg-green-50',
          description: 'Email was successfully delivered'
        };
      case 'opened':
        return {
          icon: <MailOpen className={cn(iconClasses, 'text-green-600')} size={iconSize} />,
          text: 'Opened',
          color: 'text-green-600', 
          bgColor: 'bg-green-50',
          description: 'Email has been opened by the recipient'
        };
      case 'clicked':
        return {
          icon: <CheckCircle className={cn(iconClasses, 'text-green-700')} size={iconSize} />,
          text: 'Clicked',
          color: 'text-green-700',
          bgColor: 'bg-green-50',
          description: 'Recipient clicked a link in the email'
        };
      case 'replied':
        return {
          icon: <CheckCheck className={cn(iconClasses, 'text-green-800')} size={iconSize} />,
          text: 'Replied',
          color: 'text-green-800',
          bgColor: 'bg-green-50',
          description: 'Recipient replied to the email'
        };
      case 'bounced':
        return {
          icon: <AlertCircle className={cn(iconClasses, 'text-red-500')} size={iconSize} />,
          text: 'Bounced',
          color: 'text-red-500',
          bgColor: 'bg-red-50',
          description: 'Email bounced back and was not delivered'
        };
      case 'failed':
        return {
          icon: <AlertCircle className={cn(iconClasses, 'text-red-600')} size={iconSize} />,
          text: 'Failed',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          description: 'Email failed to send'
        };
      case 'spam':
        return {
          icon: <AlertCircle className={cn(iconClasses, 'text-red-700')} size={iconSize} />,
          text: 'Marked Spam',
          color: 'text-red-700',
          bgColor: 'bg-red-50',
          description: 'Email was marked as spam'
        };
      case 'unsent':
        return {
          icon: <Clock className={cn(iconClasses, 'text-slate-400')} size={iconSize} />,
          text: 'Not Sent',
          color: 'text-slate-400',
          bgColor: 'bg-slate-50',
          description: 'Email has not been sent yet'
        };
      default:
        return {
          icon: <HelpCircle className={cn(iconClasses, 'text-slate-400')} size={iconSize} />,
          text: 'Unknown',
          color: 'text-slate-400',
          bgColor: 'bg-slate-50',
          description: 'Email status is unknown'
        };
    }
  };
  
  const config = getStatusConfig();
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              'inline-flex items-center rounded-full px-2 py-1', 
              config.bgColor,
              small ? 'text-xs' : 'text-sm',
              className
            )}
          >
            {config.icon}
            {showText && <span className={config.color}>{config.text}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}