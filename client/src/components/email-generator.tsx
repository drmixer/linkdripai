import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Card,
  CardContent,
  CardHeader
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Prospect } from "@shared/schema";
import { 
  Loader2, 
  RefreshCw, 
  Send, 
  X, 
  User, 
  Mail, 
  Building, 
  Globe, 
  Copy,
  CheckCircle2,
  Sparkles,
  MessageSquare
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EmailGeneratorProps {
  prospect: Prospect;
  onClose?: () => void;
}

export default function EmailGenerator({ prospect, onClose }: EmailGeneratorProps) {
  const { toast } = useToast();
  const [subject, setSubject] = useState(`Guest Post Opportunity for ${prospect.siteName || 'your site'}`);
  const [emailBody, setEmailBody] = useState('');
  const [emailTemplate, setEmailTemplate] = useState<'ai' | 'template1' | 'template2'>('ai');
  const [copied, setCopied] = useState(false);
  
  const generateEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/email/generate", {
        prospectId: prospect.id,
        template: emailTemplate
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
  
  const handleCopyEmail = () => {
    const fullEmail = `Subject: ${subject}\n\n${emailBody}`;
    navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    toast({
      title: "Copied to clipboard",
      description: "Email has been copied to your clipboard.",
    });
    
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };
  
  // Generate email on component mount if email body is empty
  if (!emailBody && !generateEmailMutation.isPending) {
    handleGenerateEmail();
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 h-[600px] overflow-hidden">
      {/* Left sidebar with prospect info */}
      <div className="md:col-span-2 bg-gray-50 border-r p-5 overflow-y-auto">
        <div className="mb-5">
          <h3 className="text-lg font-medium text-gray-800">Prospect Details</h3>
        </div>
        
        <div className="space-y-5">
          {/* Domain badge */}
          <div className="flex items-center">
            <div className="rounded-lg w-12 h-12 flex-shrink-0 bg-primary-100 flex items-center justify-center">
              <Globe className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-3">
              <h3 className="font-medium text-gray-900">
                {prospect.domain || prospect.siteName || 'Domain unavailable'}
              </h3>
              <div className="flex items-center mt-1">
                <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-none">
                  DA {prospect.domainAuthority}
                </Badge>
                <Badge className="ml-1 bg-gray-100 text-gray-700 hover:bg-gray-200 border-none">
                  {prospect.niche}
                </Badge>
              </div>
            </div>
          </div>
          
          {/* Contact info */}
          <Card>
            <CardHeader className="py-3 px-4">
              <h4 className="text-sm font-medium flex items-center">
                <User className="h-4 w-4 mr-2 text-gray-500" />
                Contact Information
              </h4>
            </CardHeader>
            <CardContent className="py-3 px-4">
              <dl className="space-y-3 text-sm">
                {prospect.contactRole && (
                  <div>
                    <dt className="text-gray-500">Role:</dt>
                    <dd className="font-medium">{prospect.contactRole}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500">Email:</dt>
                  <dd className="font-medium text-primary-600 break-all">{prospect.contactEmail || 'editor@' + (prospect.domain || 'example.com')}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          
          {/* Site info */}
          <Card>
            <CardHeader className="py-3 px-4">
              <h4 className="text-sm font-medium flex items-center">
                <Building className="h-4 w-4 mr-2 text-gray-500" />
                Site Information
              </h4>
            </CardHeader>
            <CardContent className="py-3 px-4">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Name:</dt>
                  <dd className="font-medium">{prospect.siteName || 'Unknown'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Type:</dt>
                  <dd className="font-medium">{prospect.siteType}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Traffic:</dt>
                  <dd className="font-medium">{prospect.monthlyTraffic} monthly visits</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Fit Score:</dt>
                  <dd>
                    <div className="flex items-center">
                      <div className="h-2 bg-gray-200 rounded-full w-full">
                        <div 
                          className={cn(
                            "h-2 rounded-full", 
                            prospect.fitScore > 75 ? "bg-green-500" : 
                            prospect.fitScore > 50 ? "bg-yellow-500" : "bg-red-500"
                          )}
                          style={{ width: `${prospect.fitScore}%` }}
                        />
                      </div>
                      <span className="ml-2 font-medium">{prospect.fitScore}%</span>
                    </div>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Right side with email editor */}
      <div className="md:col-span-3 flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-5 pb-0">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium flex items-center text-gray-800">
              <Mail className="h-5 w-5 mr-2 text-primary-600" />
              Compose Email
            </h3>
            
            <Tabs value={emailTemplate} onValueChange={(v) => setEmailTemplate(v as any)}>
              <TabsList className="h-9">
                <TabsTrigger value="ai" className="text-xs px-3">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  AI-Generated
                </TabsTrigger>
                <TabsTrigger value="template1" className="text-xs px-3">
                  Template 1
                </TabsTrigger>
                <TabsTrigger value="template2" className="text-xs px-3">
                  Template 2
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <div className="mb-5">
            <label className="block text-sm font-medium mb-2 text-gray-700">Subject:</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full focus:ring-primary-500"
            />
          </div>
          
          <div className="mb-5">
            <label className="block text-sm font-medium mb-2 text-gray-700">Email body:</label>
            <Textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Hi there, I noticed you're looking for guest post submissions..."
              rows={14}
              className="w-full resize-none focus:ring-primary-500 min-h-[250px]"
            />
          </div>
        </div>
        
        <div className="flex justify-between items-center p-5 border-t bg-gray-50">
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshEmail}
              disabled={generateEmailMutation.isPending}
              className="h-9 px-4"
            >
              {generateEmailMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Regenerate
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyEmail}
              className="relative h-9 px-4"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {copied ? "Copied" : "Copy Email"}
            </Button>
          </div>
          
          <div className="flex gap-3">
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-9 px-4"
              >
                Cancel
              </Button>
            )}
            
            <Button
              variant="default"
              size="sm"
              onClick={handleSendEmail}
              disabled={sendEmailMutation.isPending || !emailBody}
              className="h-9 px-4 bg-primary hover:bg-primary-dark"
            >
              {sendEmailMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4 mr-2" />
              )}
              Send Email
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
