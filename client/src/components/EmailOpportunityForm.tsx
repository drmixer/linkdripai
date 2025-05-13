import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { AlertCircle, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

interface EmailOpportunityFormProps {
  opportunityId: number;
  websiteId?: number;
  defaultEmail?: string;
  defaultSubject?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

interface Website {
  id: number;
  name: string;
  url: string;
}

export default function EmailOpportunityForm({
  opportunityId,
  websiteId,
  defaultEmail,
  defaultSubject = 'Opportunity for collaboration',
  onSuccess,
  onCancel
}: EmailOpportunityFormProps) {
  const { toast } = useToast();
  
  // Form state
  const [subject, setSubject] = useState(defaultSubject);
  const [toEmail, setToEmail] = useState(defaultEmail || '');
  const [body, setBody] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedWebsite, setSelectedWebsite] = useState<number | undefined>(websiteId);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  
  // Get email settings to check if user has email configured
  const { data: emailSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['/api/email/settings'],
    refetchOnWindowFocus: false
  });
  
  // Get templates
  const { data: templateData, isLoading: isLoadingTemplates } = useQuery<{ templates: EmailTemplate[] }>({
    queryKey: ['/api/email/templates'],
    refetchOnWindowFocus: false
  });
  
  // Get user's websites
  const { data: websitesData, isLoading: isLoadingWebsites } = useQuery<{ websites: Website[] }>({
    queryKey: ['/api/websites'],
    refetchOnWindowFocus: false
  });
  
  // Get opportunity details to get contact info if not provided
  const { data: opportunityData, isLoading: isLoadingOpportunity } = useQuery({
    queryKey: ['/api/opportunities', opportunityId],
    refetchOnWindowFocus: false,
    enabled: !defaultEmail // Only fetch if no default email provided
  });
  
  // Set default email from opportunity if available
  useEffect(() => {
    if (opportunityData && opportunityData.contactInfo?.emails?.length > 0 && !toEmail) {
      setToEmail(opportunityData.contactInfo.emails[0]);
    }
  }, [opportunityData, toEmail]);
  
  // Set website if not provided
  useEffect(() => {
    if (websitesData?.websites && websitesData.websites.length > 0 && !selectedWebsite) {
      setSelectedWebsite(websitesData.websites[0].id);
    }
  }, [websitesData, selectedWebsite]);
  
  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/email/send-outreach', data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: 'Email Sent',
          description: 'Your email has been sent successfully.',
          variant: 'default',
        });
        if (onSuccess) onSuccess();
      } else {
        toast({
          title: 'Error Sending Email',
          description: data.error || 'There was an error sending your email.',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'There was an error sending your email.',
        variant: 'destructive',
      });
    }
  });
  
  // Handle template selection
  const handleTemplateChange = (templateName: string) => {
    setSelectedTemplate(templateName);
    
    const template = templateData?.templates.find(t => t.name === templateName);
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  };
  
  // Handle send email
  const handleSendEmail = () => {
    if (!toEmail) {
      toast({
        title: 'Error',
        description: 'Please enter a recipient email address.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!subject) {
      toast({
        title: 'Error',
        description: 'Please enter a subject for your email.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!body) {
      toast({
        title: 'Error',
        description: 'Please enter a message body for your email.',
        variant: 'destructive',
      });
      return;
    }
    
    const emailData = {
      opportunityId,
      websiteId: selectedWebsite,
      subject,
      body,
      toEmail,
      ...(showAdvancedOptions && fromName ? { fromName } : {}),
      ...(showAdvancedOptions && fromEmail ? { fromEmail } : {})
    };
    
    sendEmailMutation.mutate(emailData);
  };
  
  // Handle cancel
  const handleCancel = () => {
    if (onCancel) onCancel();
  };
  
  const isLoading = isLoadingSettings || isLoadingTemplates || isLoadingWebsites || isLoadingOpportunity;
  
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Send Email</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </CardContent>
      </Card>
    );
  }
  
  // Check if email is configured
  const isEmailConfigured = emailSettings?.configured && emailSettings?.verified;
  
  if (!isEmailConfigured) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Send Email</CardTitle>
          <CardDescription>Configure your email settings first</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Email Not Configured</AlertTitle>
            <AlertDescription>
              You need to configure and verify your email settings before you can send emails.
              Please go to your account settings to set up email integration.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button onClick={handleCancel}>Close</Button>
        </CardFooter>
      </Card>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Send Email</CardTitle>
        <CardDescription>Send an email to this opportunity</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="toEmail">To</Label>
            <Input
              id="toEmail"
              placeholder="recipient@example.com"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="websiteSelect">From Website</Label>
            <Select 
              value={selectedWebsite?.toString()} 
              onValueChange={(value) => setSelectedWebsite(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a website" />
              </SelectTrigger>
              <SelectContent>
                {websitesData?.websites.map((website) => (
                  <SelectItem key={website.id} value={website.id.toString()}>
                    {website.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="templateSelect">Email Template</Label>
          <Select onValueChange={handleTemplateChange} value={selectedTemplate || undefined}>
            <SelectTrigger>
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent>
              {templateData?.templates.map((template) => (
                <SelectItem key={template.name} value={template.name}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            placeholder="Email subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="body">Message</Label>
          <Textarea
            id="body"
            placeholder="Your email message..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[200px]"
          />
        </div>
        
        <Collapsible
          open={showAdvancedOptions}
          onOpenChange={setShowAdvancedOptions}
          className="border rounded-md p-3"
        >
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium">Advanced Options</span>
              {showAdvancedOptions ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fromName">Custom From Name (Optional)</Label>
                <Input
                  id="fromName"
                  placeholder="Your Name"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fromEmail">Custom From Email (Optional)</Label>
                <Input
                  id="fromEmail"
                  placeholder="your@email.com"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleSendEmail}
          disabled={sendEmailMutation.isPending}
        >
          {sendEmailMutation.isPending ? 'Sending...' : 'Send Email'}
        </Button>
      </CardFooter>
    </Card>
  );
}