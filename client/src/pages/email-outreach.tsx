import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet';
import { Check, Inbox, Settings, Loader2 } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { OutreachTable } from '@/components/outreach-table';
import Layout from '@/components/layout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function EmailOutreachPage() {
  const [showEmailSettings, setShowEmailSettings] = useState(false);
  const { toast } = useToast();

  // Get email settings to check if email is configured
  const { 
    data: settings, 
    isLoading: settingsLoading 
  } = useQuery({
    queryKey: ['/api/email/settings'],
    queryFn: async () => {
      const res = await fetch('/api/email/settings');
      if (!res.ok) {
        throw new Error('Failed to fetch email settings');
      }
      return res.json();
    }
  });

  // Get all emails
  const { 
    data: emails = [], 
    isLoading: emailsLoading,
    refetch: refetchEmails
  } = useQuery({
    queryKey: ['/api/emails'],
    queryFn: async () => {
      const res = await fetch('/api/emails');
      if (!res.ok) {
        throw new Error('Failed to fetch emails');
      }
      return res.json();
    },
    enabled: !!settings?.isConfigured,
  });

  // Function to refresh email inbox
  const refreshEmails = () => {
    refetchEmails();
  };

  // Email setup warning alert, but still show the rest of the page
  const showEmailSetupAlert = !settingsLoading && !settings?.isConfigured;

  // Show loading while settings and emails are being fetched
  if (settingsLoading) {
    return (
      <Layout title="Email Outreach">
        <Helmet>
          <title>Email Outreach - LinkDripAI</title>
        </Helmet>
        
        <div className="flex justify-center items-center h-60">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-lg">Loading email settings...</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Multi-Channel Outreach" subtitle="Manage your email and other outreach campaigns to connect with prospects.">
      <Helmet>
        <title>Multi-Channel Outreach - LinkDripAI</title>
        <meta 
          name="description" 
          content="Manage your email, social media, and contact form outreach campaigns to connect with prospects."
        />
      </Helmet>
      
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-3">
          <Dialog open={showEmailSettings} onOpenChange={setShowEmailSettings}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Email Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Email Settings</DialogTitle>
                <DialogDescription>
                  View and manage your email integration settings
                </DialogDescription>
              </DialogHeader>
              
              <div className="my-6">
                <h3 className="text-lg font-medium mb-4">Current Email Configuration</h3>
                
                {settings && (
                  <div className="space-y-4">
                    <div className="flex justify-between py-2 border-b">
                      <span className="font-medium">Provider</span>
                      <span className="capitalize">{settings?.provider || "Not configured"}</span>
                    </div>
                    
                    <div className="flex justify-between py-2 border-b">
                      <span className="font-medium">From Email</span>
                      <span>{settings?.fromEmail || "Not configured"}</span>
                    </div>
                    
                    <div className="flex justify-between py-2 border-b">
                      <span className="font-medium">Verified</span>
                      <span>{settings?.isVerified ? 
                        <Check className="text-green-500 h-5 w-5" /> : 
                        <Button size="sm" variant="outline" onClick={() => {
                          // Open verification dialog/flow
                          toast({
                            title: "Verification",
                            description: "You'll be redirected to email verification in your account settings.",
                          });
                          setTimeout(() => {
                            window.location.href = '/settings?tab=email';
                          }, 1500);
                        }}>
                          Verify Now
                        </Button>
                      }</span>
                    </div>
                  </div>
                )}
                
                <div className="mt-6">
                  <Button 
                    onClick={() => {
                      window.location.href = '/settings?tab=email';
                    }}
                  >
                    {settings?.isConfigured ? "Update Email Settings" : "Set Up Email"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {showEmailSetupAlert && (
        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <AlertTitle>Email Setup Recommended</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <div>
              <p className="mb-2">
                Setting up email will enable direct email outreach capabilities, but you can still use other outreach methods.
              </p>
              <p className="text-sm text-blue-700">
                Configure your preferred email provider (SendGrid, SMTP, or Gmail) to enable email outreach features.
              </p>
            </div>
            <Button 
              size="sm"
              className="whitespace-nowrap"
              onClick={() => window.location.href = '/settings?tab=email'}
            >
              Set Up Email
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-6">
        <Tabs defaultValue="outreach" className="w-full">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="outreach">Outreach Dashboard</TabsTrigger>
            <TabsTrigger value="email-history">Email History</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>
          
          <TabsContent value="outreach">
            <div className="grid grid-cols-1 gap-8">
              {settings?.isConfigured ? (
                <>
                  <OutreachTable 
                    emails={emails || []} 
                    isLoading={emailsLoading} 
                    onRefresh={refreshEmails} 
                  />
                </>
              ) : (
                <>
                  <div className="bg-white rounded-lg border shadow-sm p-6">
                    <h2 className="text-xl font-semibold mb-4">Multi-Channel Outreach</h2>
                    <p className="text-muted-foreground mb-6">
                      Reach out to opportunities through multiple channels including social media, contact forms, and more.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border rounded-lg p-4 bg-blue-50">
                        <h3 className="text-lg font-medium mb-2 flex items-center">
                          <Mail className="h-5 w-5 mr-2 text-blue-600" />
                          Email Outreach
                        </h3>
                        <p className="text-sm text-gray-600 mb-3">Send personalized emails directly from the platform.</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-blue-700 border-blue-300"
                          onClick={() => window.location.href = '/settings?tab=email'}
                        >
                          Set Up Email
                        </Button>
                      </div>
                      
                      <div className="border rounded-lg p-4">
                        <h3 className="text-lg font-medium mb-2 flex items-center">
                          <MessageSquare className="h-5 w-5 mr-2 text-purple-600" />
                          Social Media Outreach
                        </h3>
                        <p className="text-sm text-gray-600 mb-3">Connect via LinkedIn, Twitter and other platforms.</p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            // This would normally navigate to a social media outreach page
                            // For now, we'll just show a toast
                            toast({
                              title: "Social Media Outreach",
                              description: "This feature is available now. Visit the opportunity details to use it."
                            });
                          }}
                        >
                          Available Now
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="email-history">
            {settings?.isConfigured ? (
              <OutreachTable 
                emails={emails || []} 
                isLoading={emailsLoading} 
                onRefresh={refreshEmails} 
              />
            ) : (
              <div className="bg-white rounded-lg border shadow-sm p-8 text-center">
                <Inbox className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-semibold mb-2">Email History</h2>
                <p className="text-muted-foreground mb-6">
                  Set up email to see your outreach history and track responses.
                </p>
                <Button size="lg" onClick={() => window.location.href = '/settings?tab=email'}>
                  Set Up Email
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="templates">
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Outreach Templates</h2>
              <p className="text-muted-foreground mb-6">
                Create and manage templates for your outreach campaigns.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-2">Email Templates</h3>
                  <p className="text-sm text-gray-600 mb-3">Customizable email templates for different outreach scenarios.</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      toast({
                        title: "Email Templates",
                        description: "Email templates are available on the opportunity details page."
                      });
                    }}
                  >
                    Available Now
                  </Button>
                </div>
                
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-2">Social Media Templates</h3>
                  <p className="text-sm text-gray-600 mb-3">Templates for LinkedIn, Twitter, and other social platforms.</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      toast({
                        title: "Social Media Templates",
                        description: "Social media templates are available on the opportunity details page."
                      });
                    }}
                  >
                    Available Now
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}