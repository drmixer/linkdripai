import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Prospect } from "@shared/schema";
import { Loader2, RefreshCw, Send } from "lucide-react";

interface EmailGeneratorProps {
  prospect: Prospect;
}

export default function EmailGenerator({ prospect }: EmailGeneratorProps) {
  const { toast } = useToast();
  const [subject, setSubject] = useState(`Guest post opportunity for ${prospect.siteName || 'your blog'}`);
  const [emailBody, setEmailBody] = useState('');
  const [template, setTemplate] = useState('guest-post');
  
  const generateEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/email/generate", {
        prospectId: prospect.id,
        template,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setSubject(data.subject);
      setEmailBody(data.body);
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
  
  // Generate email on component mount if email body is empty
  if (!emailBody && !generateEmailMutation.isPending) {
    handleGenerateEmail();
  }
  
  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-md font-medium text-gray-900">Generate outreach email for:</h3>
            <div className="mt-1 flex items-center">
              <div className="flex-shrink-0 h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium">
                {prospect.siteName ? prospect.siteName.substring(0, 2).toUpperCase() : 'SP'}
              </div>
              <div className="ml-3">
                <span className="text-sm font-medium text-gray-900 truncate">
                  {prospect.siteName} ({prospect.contactEmail})
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 md:mt-0 md:ml-4 flex items-center space-x-3">
            <Select
              value={template}
              onValueChange={setTemplate}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="guest-post">Guest Post Template</SelectItem>
                <SelectItem value="resource-mention">Resource Mention</SelectItem>
                <SelectItem value="collaboration">Collaboration Request</SelectItem>
                <SelectItem value="custom">Custom Template</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      <div className="px-6 py-4">
        <div className="mb-4">
          <Label htmlFor="email-subject">Subject Line</Label>
          <Input
            id="email-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="email-body">Email Body</Label>
          <Textarea
            id="email-body"
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            rows={12}
            className="mt-1"
          />
        </div>
        
        <div className="mt-4 flex justify-between">
          <Button
            variant="outline"
            onClick={handleGenerateEmail}
            disabled={generateEmailMutation.isPending}
          >
            {generateEmailMutation.isPending ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-5 w-5 mr-2" />
            )}
            Regenerate
          </Button>
          <Button
            onClick={handleSendEmail}
            disabled={sendEmailMutation.isPending || !emailBody}
          >
            {sendEmailMutation.isPending ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Send className="h-5 w-5 mr-2" />
            )}
            Send Email
          </Button>
        </div>
      </div>
    </div>
  );
}
