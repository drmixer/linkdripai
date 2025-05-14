import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { AlertCircle, ChevronDown, ChevronUp, Mail, ExternalLink, MessageCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

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
  const [showFallback, setShowFallback] = useState(false);
  const [selectedContactMethod, setSelectedContactMethod] = useState<string>('email');
  
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
  
  // Check if we have contact information
  const hasEmails = opportunityData?.contactInfo?.emails?.length > 0;
  const hasSocialProfiles = opportunityData?.contactInfo?.socialProfiles?.length > 0;
  const hasContactForms = opportunityData?.contactInfo?.contactForms?.length > 0;
  
  // If no contact information available at all
  if (!hasEmails && !hasSocialProfiles && !hasContactForms && !defaultEmail && !isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Contact Opportunity</CardTitle>
          <CardDescription>No contact information available</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Contact Information</AlertTitle>
            <AlertDescription>
              We couldn't find any contact information for this opportunity.
              Try using our SuperEmailExtractor to find contact details.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button onClick={handleCancel}>Close</Button>
        </CardFooter>
      </Card>
    );
  }
  
  if (!isEmailConfigured && selectedContactMethod === 'email') {
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
          
          {(hasSocialProfiles || hasContactForms) && (
            <div className="mt-4">
              <Alert variant="default">
                <AlertTitle>Alternative Contact Methods Available</AlertTitle>
                <AlertDescription>
                  This opportunity has alternative contact methods available.
                  You can use one of these instead of email.
                </AlertDescription>
              </Alert>
              
              <div className="flex space-x-2 mt-4">
                {hasSocialProfiles && (
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedContactMethod('social')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Social Profiles
                  </Button>
                )}
                
                {hasContactForms && (
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedContactMethod('form')}
                    className="flex items-center gap-2"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Use Contact Forms
                  </Button>
                )}
              </div>
            </div>
          )}
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
        <CardTitle>Contact Opportunity</CardTitle>
        <CardDescription>Reach out to this opportunity</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Contact Method Tabs */}
        <Tabs 
          value={selectedContactMethod} 
          onValueChange={setSelectedContactMethod}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger 
              value="email" 
              disabled={!hasEmails && !defaultEmail}
              className="flex items-center gap-1"
            >
              <Mail className="h-4 w-4" />
              Email
              {!hasEmails && !defaultEmail && " (Unavailable)"}
            </TabsTrigger>
            <TabsTrigger 
              value="social" 
              disabled={!hasSocialProfiles}
              className="flex items-center gap-1"
            >
              <ExternalLink className="h-4 w-4" />
              Social
              {!hasSocialProfiles && " (Unavailable)"}
            </TabsTrigger>
            <TabsTrigger 
              value="form" 
              disabled={!hasContactForms}
              className="flex items-center gap-1"
            >
              <MessageCircle className="h-4 w-4" />
              Contact Form
              {!hasContactForms && " (Unavailable)"}
            </TabsTrigger>
          </TabsList>
          
          {/* Email Tab Content */}
          <TabsContent value="email" className="pt-4 space-y-4">
            {!isEmailConfigured ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Email Not Configured</AlertTitle>
                <AlertDescription>
                  You need to configure your email settings before sending emails.
                </AlertDescription>
              </Alert>
            ) : (
              <>
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
              </>
            )}
          </TabsContent>
          
          {/* Social Profiles Tab Content */}
          <TabsContent value="social" className="pt-4 space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Contact via Social Profiles</AlertTitle>
              <AlertDescription>
                Reach out through one of the available social media platforms below.
              </AlertDescription>
            </Alert>
            
            <ScrollArea className="h-[300px] rounded-md border p-4">
              {opportunityData?.contactInfo?.socialProfiles?.map((profile, index) => (
                <div key={index} className="mb-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium capitalize">{profile.platform}</h4>
                    <a 
                      href={profile.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-1">
                    Username: {profile.username}
                  </p>
                  
                  <Separator className="my-2" />
                </div>
              ))}
            </ScrollArea>
          </TabsContent>
          
          {/* Contact Forms Tab Content */}
          <TabsContent value="form" className="pt-4 space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Contact via Form</AlertTitle>
              <AlertDescription>
                Use one of the available contact forms below to reach out.
              </AlertDescription>
            </Alert>
            
            <ScrollArea className="h-[300px] rounded-md border p-4">
              {opportunityData?.contactInfo?.contactForms?.map((formUrl, index) => (
                <div key={index} className="mb-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Contact Form {index + 1}</h4>
                    <a 
                      href={formUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      Open Form <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {formUrl}
                  </p>
                  
                  <Separator className="my-2" />
                </div>
              ))}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        
        {selectedContactMethod === 'email' && isEmailConfigured && (
          <Button 
            onClick={handleSendEmail}
            disabled={sendEmailMutation.isPending}
          >
            {sendEmailMutation.isPending ? 'Sending...' : 'Send Email'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}