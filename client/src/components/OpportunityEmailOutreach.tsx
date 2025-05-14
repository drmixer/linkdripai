import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { EmailStatusIndicator, type EmailStatus } from './EmailStatusIndicator';
import { useToast } from '@/hooks/use-toast';
import { Mail, SendHorizonal, Check, AlertCircle, Loader2 } from 'lucide-react';
import { EmailTemplateEditor } from './EmailTemplateEditor';

interface OpportunityEmailOutreachProps {
  opportunity: {
    id: number;
    url: string;
    domain: string;
    title: string;
    domainAuthority: number;
    pageAuthority?: number;
    spamScore?: number;
    relevanceScore: number;
    type: string;
    contactInfo?: {
      emails?: string[];
      socialProfiles?: Array<{
        platform: string;
        url: string;
        username: string;
      }>;
      contactForms?: string[];
    };
  };
  emailAccounts: Array<{
    id: number;
    email: string;
    name: string;
    website: string;
  }>;
  emailTemplates: Array<{
    id: string;
    name: string;
    subject: string;
    body: string;
  }>;
  onEmailSent: (opportunityId: number, emailData: any) => void;
}

/**
 * A component for sending email outreach to backlink opportunities
 */
export function OpportunityEmailOutreach({ 
  opportunity, 
  emailAccounts,
  emailTemplates,
  onEmailSent
}: OpportunityEmailOutreachProps) {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState('email');
  const [loading, setLoading] = useState(false);
  const [emailData, setEmailData] = useState({
    fromAccount: emailAccounts[0]?.id || '',
    toEmail: opportunity.contactInfo?.emails?.[0] || '',
    subject: '',
    body: '',
    template: '',
    status: 'draft' as EmailStatus
  });
  
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  
  // Check if there are email contacts available
  const hasEmails = opportunity.contactInfo?.emails && opportunity.contactInfo.emails.length > 0;
  
  // Generate email preview data
  const emailPreviewData = {
    website: opportunity.url,
    domain: opportunity.domain,
    domainAuthority: opportunity.domainAuthority.toString(),
    pageAuthority: opportunity.pageAuthority?.toString() || '0',
    relevanceScore: `${opportunity.relevanceScore}%`,
    opportunityType: opportunity.type,
  };
  
  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    const selectedTemplate = emailTemplates.find(t => t.id === templateId);
    if (selectedTemplate) {
      setEmailData({
        ...emailData,
        template: templateId,
        subject: selectedTemplate.subject,
        body: selectedTemplate.body
      });
    }
  };
  
  // Replace template variables with actual values
  const replaceVariables = (text: string, data: Record<string, string>) => {
    return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return data[variable] || match;
    });
  };
  
  // Handle sending the email
  const handleSendEmail = async () => {
    if (!emailData.toEmail || !emailData.subject || !emailData.body) {
      toast({
        title: "Missing Information",
        description: "Please fill out all email fields before sending",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Simulate sending email - in a real app, this would call your API
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update status to 'sent'
      const sentEmailData = {
        ...emailData,
        status: 'sent' as EmailStatus,
        sentAt: new Date().toISOString()
      };
      
      // Call the onEmailSent callback
      onEmailSent(opportunity.id, sentEmailData);
      
      // Show success toast
      toast({
        title: "Email Sent",
        description: `Outreach email sent to ${emailData.toEmail}`,
        variant: "default"
      });
      
      // Reset form
      setEmailData({
        ...emailData,
        status: 'sent'
      });
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Failed to Send",
        description: "There was an error sending your email. Please try again.",
        variant: "destructive"
      });
      
      // Update status to 'failed'
      setEmailData({
        ...emailData,
        status: 'failed'
      });
    }
    
    setLoading(false);
  };
  
  // Handle saving a new template
  const handleSaveTemplate = (template: any) => {
    // In a real app, this would save the template to your backend
    toast({
      title: "Template Saved",
      description: `Template "${template.name}" has been saved successfully`,
    });
    
    setShowTemplateEditor(false);
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Contact Opportunity</CardTitle>
            <CardDescription>
              Reach out to {opportunity.domain} via your preferred method
            </CardDescription>
          </div>
          {emailData.status !== 'draft' && (
            <EmailStatusIndicator status={emailData.status} showText />
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="email" disabled={!hasEmails}>
              <Mail className="h-4 w-4 mr-2" />
              Email
              {!hasEmails && (
                <Badge variant="destructive" className="ml-2">
                  No Emails
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="social">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 mr-2"
              >
                <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
              </svg>
              Social
            </TabsTrigger>
            <TabsTrigger value="form">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 mr-2"
              >
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                <path d="M18 14h-8" />
                <path d="M15 18h-5" />
                <path d="M10 6h8v4h-8V6Z" />
              </svg>
              Contact Form
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="email" className="space-y-4">
            {!showTemplateEditor ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="from-email">From</Label>
                  <Select
                    value={emailData.fromAccount.toString()}
                    onValueChange={(value) => 
                      setEmailData({ ...emailData, fromAccount: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your email account" />
                    </SelectTrigger>
                    <SelectContent>
                      {emailAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          {account.name} ({account.email}) - {account.website}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="to-email">To</Label>
                  <Select
                    value={emailData.toEmail}
                    onValueChange={(value) => 
                      setEmailData({ ...emailData, toEmail: value })
                    }
                    disabled={!hasEmails}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        hasEmails 
                          ? "Select recipient email" 
                          : "No email contacts available"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {opportunity.contactInfo?.emails?.map((email) => (
                        <SelectItem key={email} value={email}>
                          {email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="template">Email Template</Label>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowTemplateEditor(true)}
                    >
                      Create New
                    </Button>
                  </div>
                  <Select
                    value={emailData.template}
                    onValueChange={handleTemplateSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template or create new" />
                    </SelectTrigger>
                    <SelectContent>
                      {emailTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
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
                    value={emailData.subject}
                    onChange={(e) => 
                      setEmailData({ ...emailData, subject: e.target.value })
                    }
                    placeholder="Enter email subject"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="body">Message</Label>
                  <div className="rounded-md border">
                    <textarea
                      className="w-full min-h-[200px] p-3 rounded-md"
                      id="body"
                      value={emailData.body}
                      onChange={(e) => 
                        setEmailData({ ...emailData, body: e.target.value })
                      }
                      placeholder="Enter your message..."
                    />
                  </div>
                </div>
                
                <div className="rounded-md bg-muted p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Preview shows how your email will appear with variables replaced
                    </span>
                  </div>
                  <div className="mt-2 space-y-2">
                    <div className="text-sm font-medium">
                      {replaceVariables(emailData.subject, emailPreviewData)}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">
                      {replaceVariables(emailData.body, emailPreviewData)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <EmailTemplateEditor
                onSave={handleSaveTemplate}
              />
            )}
          </TabsContent>
          
          <TabsContent value="social" className="space-y-4">
            <div className="rounded-md border p-4">
              {opportunity.contactInfo?.socialProfiles && 
               opportunity.contactInfo.socialProfiles.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-md font-medium">Available Social Profiles</h3>
                  <div className="space-y-2">
                    {opportunity.contactInfo.socialProfiles.map((profile, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded-md border">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mr-3">
                            {profile.platform === 'twitter' && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" /></svg>
                            )}
                            {profile.platform === 'facebook' && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                            )}
                            {profile.platform === 'linkedin' && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" /></svg>
                            )}
                            {profile.platform === 'instagram' && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
                            )}
                            {!['twitter', 'facebook', 'linkedin', 'instagram'].includes(profile.platform) && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" x2="22" y1="12" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                            )}
                          </div>
                          <div>
                            <div className="font-medium capitalize">{profile.platform}</div>
                            <div className="text-sm text-muted-foreground">{profile.username}</div>
                          </div>
                        </div>
                        <Button 
                          onClick={() => window.open(profile.url, '_blank')}
                          variant="outline"
                          size="sm"
                        >
                          Visit Profile
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                  <h3 className="mt-2 text-md font-medium">No Social Profiles Available</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    We couldn't find any social profiles for this opportunity
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="form" className="space-y-4">
            <div className="rounded-md border p-4">
              {opportunity.contactInfo?.contactForms && 
               opportunity.contactInfo.contactForms.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-md font-medium">Available Contact Forms</h3>
                  <div className="space-y-2">
                    {opportunity.contactInfo.contactForms.map((formUrl, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded-md border">
                        <div className="overflow-hidden overflow-ellipsis">
                          <div className="font-medium">Contact Form {index + 1}</div>
                          <div className="text-sm text-muted-foreground">{formUrl}</div>
                        </div>
                        <Button 
                          onClick={() => window.open(formUrl, '_blank')}
                          variant="outline"
                          size="sm"
                        >
                          Open Form
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                  <h3 className="mt-2 text-md font-medium">No Contact Forms Available</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    We couldn't find any contact forms for this opportunity
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      {selectedTab === 'email' && !showTemplateEditor && (
        <CardFooter className="flex justify-between">
          <div>
            {emailData.status === 'sent' && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Check className="h-4 w-4 mr-1 text-green-500" />
                Email sent successfully
              </div>
            )}
          </div>
          <Button 
            onClick={handleSendEmail}
            disabled={
              !emailData.toEmail || 
              !emailData.subject || 
              !emailData.body || 
              loading ||
              emailData.status === 'sent'
            }
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <SendHorizonal className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </CardFooter>
      )}
      
      {showTemplateEditor && (
        <CardFooter>
          <Button 
            variant="outline" 
            onClick={() => setShowTemplateEditor(false)}
          >
            Cancel
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}