import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Prospect } from "@shared/schema";
import { Loader2, RefreshCw, Send, X } from "lucide-react";

interface EmailGeneratorProps {
  prospect: Prospect;
  onClose?: () => void;
}

export default function EmailGenerator({ prospect, onClose }: EmailGeneratorProps) {
  const { toast } = useToast();
  const [subject, setSubject] = useState(`Guest Post Opportunity for ${prospect.siteName || 'E-commerce Blog'}`);
  const [emailBody, setEmailBody] = useState('');
  
  const generateEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/email/generate", {
        prospectId: prospect.id,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setSubject(data.subject || subject);
      setEmailBody(data.body || '');
      toast({
        title: "Email generated",
        description: "Your email has been generated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate email",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/email/send", {
        prospectId: prospect.id,
        subject,
        body: emailBody,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Email sent",
        description: "Your email has been sent successfully.",
      });
      if (onClose) onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send email",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleGenerateEmail = () => {
    generateEmailMutation.mutate();
  };
  
  const handleSendEmail = () => {
    sendEmailMutation.mutate();
  };
  
  const handleRefreshEmail = () => {
    handleGenerateEmail();
  };
  
  // Generate email on component mount if email body is empty
  if (!emailBody && !generateEmailMutation.isPending) {
    handleGenerateEmail();
  }
  
  return (
    <div className="bg-white rounded-md overflow-hidden relative">
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="text-lg font-medium">Generate AI Email</h3>
        {onClose && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div className="p-4">
        <p className="text-sm text-gray-600 mb-4">
          AI-powered outreach for {prospect.siteName || 'sample-opportunity-16.com'}. Review and send.
        </p>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Subject:</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full"
          />
        </div>
        
        <div className="mb-4">
          <Textarea
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            placeholder="Hi there, I noticed you're looking for guest post submissions..."
            rows={8}
            className="w-full resize-none"
          />
        </div>
      </div>
      
      <div className="flex justify-between p-4 border-t bg-gray-50">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshEmail}
          disabled={generateEmailMutation.isPending}
        >
          {generateEmailMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1.5" />
          )}
          Refresh Email
        </Button>
        
        <div className="flex gap-2">
          {onClose && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>
          )}
          
          <Button
            variant="default"
            size="sm"
            onClick={handleSendEmail}
            disabled={sendEmailMutation.isPending || !emailBody}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {sendEmailMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1.5" />
            )}
            Send Email
          </Button>
        </div>
      </div>
    </div>
  );
}
