import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet';
import { Check, Inbox, Settings, Loader2 } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { OutreachTable } from '@/components/outreach-table';
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

  // Show configuration needed message if email is not configured
  if (!settingsLoading && !settings?.isConfigured) {
    return (
      <div className="container py-8 max-w-full">
        <Helmet>
          <title>Email Outreach - LinkDripAI</title>
          <meta 
            name="description" 
            content="Manage your email outreach campaigns and track responses from your prospects."
          />
        </Helmet>
        
        <h1 className="text-3xl font-bold mb-8">Email Outreach</h1>
        
        <div className="bg-white rounded-lg border shadow-sm p-8 text-center">
          <div className="mb-6">
            <Settings className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Email Setup Required</h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-6">
              To use the email outreach features, you need to configure your email settings first.
              You can set up your preferred email provider (SendGrid, SMTP, or Gmail).
            </p>
            
            <Alert className="max-w-lg mx-auto mb-6 text-left bg-blue-50 border-blue-200">
              <AlertTitle>Important</AlertTitle>
              <AlertDescription>
                <p className="mb-2">
                  Your email provider settings are securely stored and only used to send emails on your behalf.
                  We support multiple providers to fit your needs:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>SendGrid</strong> - Easy cloud-based email delivery service</li>
                  <li><strong>SMTP</strong> - Works with most email providers like Gmail, Outlook, etc.</li>
                  <li><strong>Gmail</strong> - Direct integration with your Google account</li>
                </ul>
              </AlertDescription>
            </Alert>
            
            <Button size="lg" onClick={() => window.location.href = '/onboarding?step=email'}>
              Set Up Email
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading while settings and emails are being fetched
  if (settingsLoading) {
    return (
      <div className="container mx-auto py-8 max-w-7xl">
        <Helmet>
          <title>Email Outreach - LinkDripAI</title>
        </Helmet>
        
        <h1 className="text-3xl font-bold mb-8">Email Outreach</h1>
        
        <div className="flex justify-center items-center h-60">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-lg">Loading email settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-full">
      <Helmet>
        <title>Email Outreach - LinkDripAI</title>
        <meta 
          name="description" 
          content="Manage your email outreach campaigns and track responses from your prospects."
        />
      </Helmet>
      
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Email Outreach</h1>
        
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
                      <span className="capitalize">{settings.provider}</span>
                    </div>
                    
                    <div className="flex justify-between py-2 border-b">
                      <span className="font-medium">From Email</span>
                      <span>{settings.fromEmail}</span>
                    </div>
                    
                    <div className="flex justify-between py-2 border-b">
                      <span className="font-medium">Verified</span>
                      <span>{settings.isVerified ? 
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
                    
                    <div className="flex justify-between py-2 border-b">
                      <span className="font-medium">Terms Accepted</span>
                      <span>{settings.termsAccepted ? 
                        <Check className="text-green-500 h-5 w-5" /> : 
                        'No'
                      }</span>
                    </div>
                  </div>
                )}
                
                <div className="mt-6">
                  <Button 
                    onClick={() => {
                      window.location.href = '/onboarding?step=email';
                    }}
                  >
                    Update Email Settings
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {settings?.isConfigured ? (
        <div className="space-y-6">
          {!settings.isVerified && (
            <Alert className="mb-6 bg-amber-50 border-amber-200">
              <AlertTitle>Email Not Verified</AlertTitle>
              <AlertDescription>
                Your email address is not verified. Please verify your email to ensure reliable delivery.
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-amber-700 underline ml-2"
                  onClick={() => {
                    window.location.href = '/settings?tab=email';
                  }}
                >
                  Verify now
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          <OutreachTable 
            emails={emails} 
            isLoading={emailsLoading} 
            onRefresh={refreshEmails} 
          />
        </div>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm p-8 text-center">
          <Inbox className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Email Setup Required</h2>
          <p className="text-muted-foreground mb-6">
            To use email outreach features, you need to configure your email settings first.
          </p>
          <Button size="lg" onClick={() => window.location.href = '/onboarding?step=email'}>
            Set Up Email
          </Button>
        </div>
      )}
    </div>
  );
}