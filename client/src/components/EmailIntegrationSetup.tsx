import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { AlertCircle, Check, CheckCircle, Mail, XCircle } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

type EmailProvider = 'sendgrid' | 'smtp' | 'gmail';

interface EmailSettings {
  configured: boolean;
  verified: boolean;
  provider: EmailProvider | null;
  fromEmail: string;
  fromName?: string;
  termsAccepted: boolean;
  hasSmtp: boolean;
  hasSendgrid: boolean;
  hasGmail: boolean;
}

export default function EmailIntegrationSetup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Default tab to show
  const [activeTab, setActiveTab] = useState<EmailProvider>('sendgrid');
  
  // Form state
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Provider-specific states
  const [sendgridApiKey, setSendgridApiKey] = useState('');
  
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  
  const [gmailClientId, setGmailClientId] = useState('');
  const [gmailClientSecret, setGmailClientSecret] = useState('');
  
  // State for the test email
  const [testEmail, setTestEmail] = useState('');
  const [showTestEmail, setShowTestEmail] = useState(false);
  
  // Fetch email settings
  const { data: emailSettings, isLoading } = useQuery<EmailSettings>({
    queryKey: ['/api/email/settings'],
    refetchOnWindowFocus: false
  });
  
  // Set initial form values from fetched settings
  useEffect(() => {
    if (emailSettings) {
      setFromEmail(emailSettings.fromEmail || '');
      setFromName(emailSettings.fromName || '');
      setTermsAccepted(emailSettings.termsAccepted || false);
      
      if (emailSettings.provider) {
        setActiveTab(emailSettings.provider);
      }
    }
  }, [emailSettings]);
  
  // Save email settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/email/settings', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Settings Saved',
        description: 'Your email integration settings have been saved.',
        variant: 'default',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/email/settings'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error Saving Settings',
        description: error.message || 'There was an error saving your settings.',
        variant: 'destructive',
      });
    }
  });
  
  // Verify email settings mutation
  const verifySettingsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/email/verify', {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: 'Verification Successful',
          description: 'Your email integration has been verified.',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Verification Failed',
          description: data.error || 'There was an error verifying your settings.',
          variant: 'destructive',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/email/settings'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Verification Failed',
        description: error.message || 'There was an error verifying your settings.',
        variant: 'destructive',
      });
    }
  });
  
  // Send test email mutation
  const sendTestEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest('POST', '/api/email/test', { testEmail: email });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: 'Test Email Sent',
          description: 'A test email has been sent successfully.',
          variant: 'default',
        });
        setShowTestEmail(false);
      } else {
        toast({
          title: 'Test Email Failed',
          description: data.error || 'There was an error sending the test email.',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Test Email Failed',
        description: error.message || 'There was an error sending the test email.',
        variant: 'destructive',
      });
    }
  });
  
  // Accept terms mutation
  const acceptTermsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/email/accept-terms', {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Terms Accepted',
        description: 'You have accepted the email integration terms.',
        variant: 'default',
      });
      setTermsAccepted(true);
      queryClient.invalidateQueries({ queryKey: ['/api/email/settings'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'There was an error accepting the terms.',
        variant: 'destructive',
      });
    }
  });
  
  // Handle save settings
  const handleSaveSettings = () => {
    const baseSettings = {
      provider: activeTab,
      fromEmail,
      fromName,
    };
    
    let settings;
    
    switch (activeTab) {
      case 'sendgrid':
        settings = {
          ...baseSettings,
          sendgridApiKey,
        };
        break;
        
      case 'smtp':
        settings = {
          ...baseSettings,
          smtpHost,
          smtpPort: parseInt(smtpPort),
          smtpUsername,
          smtpPassword,
        };
        break;
        
      case 'gmail':
        settings = {
          ...baseSettings,
          gmailClientId,
          gmailClientSecret,
        };
        break;
        
      default:
        toast({
          title: 'Error',
          description: 'Please select a valid email provider.',
          variant: 'destructive',
        });
        return;
    }
    
    saveSettingsMutation.mutate(settings);
  };
  
  // Handle verify settings
  const handleVerifySettings = () => {
    verifySettingsMutation.mutate();
  };
  
  // Handle send test email
  const handleSendTestEmail = () => {
    if (!testEmail) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }
    
    sendTestEmailMutation.mutate(testEmail);
  };
  
  // Handle accept terms
  const handleAcceptTerms = () => {
    acceptTermsMutation.mutate();
  };
  
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Email Integration</CardTitle>
          <CardDescription>Loading your email settings...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Email Integration</CardTitle>
            <CardDescription>Set up email integration to email opportunities directly.</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            {emailSettings?.configured && (
              <div className="flex items-center space-x-1">
                <span className="text-sm text-muted-foreground">Configured</span>
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
            )}
            {emailSettings?.verified && (
              <div className="flex items-center space-x-1">
                <span className="text-sm text-muted-foreground">Verified</span>
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!emailSettings?.termsAccepted && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Accept Terms</AlertTitle>
            <AlertDescription>
              Before using email integration, you must accept our email sending terms.
              <div className="mt-4 flex items-center space-x-2">
                <Checkbox 
                  id="terms" 
                  checked={termsAccepted} 
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)} 
                />
                <Label htmlFor="terms" className="text-sm">
                  I agree to the email sending terms and will not use this feature for spam or unsolicited emails.
                </Label>
              </div>
              <Button 
                className="mt-4" 
                onClick={handleAcceptTerms} 
                disabled={!termsAccepted}
              >
                Accept Terms
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromEmail">From Email</Label>
              <Input
                id="fromEmail"
                placeholder="your@email.com"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fromName">From Name (Optional)</Label>
              <Input
                id="fromName"
                placeholder="Your Name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as EmailProvider)}>
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="sendgrid">SendGrid</TabsTrigger>
              <TabsTrigger value="smtp">SMTP</TabsTrigger>
              <TabsTrigger value="gmail">Gmail</TabsTrigger>
            </TabsList>
            
            <TabsContent value="sendgrid" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sendgridApiKey">SendGrid API Key</Label>
                <Input
                  id="sendgridApiKey"
                  placeholder="SG.xxxxx"
                  type="password"
                  value={sendgridApiKey}
                  onChange={(e) => setSendgridApiKey(e.target.value)}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                Use SendGrid for reliable email delivery with detailed tracking.
              </div>
            </TabsContent>
            
            <TabsContent value="smtp" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">SMTP Host</Label>
                  <Input
                    id="smtpHost"
                    placeholder="smtp.example.com"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">SMTP Port</Label>
                  <Input
                    id="smtpPort"
                    placeholder="587"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpUsername">SMTP Username</Label>
                  <Input
                    id="smtpUsername"
                    placeholder="username"
                    value={smtpUsername}
                    onChange={(e) => setSmtpUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPassword">SMTP Password</Label>
                  <Input
                    id="smtpPassword"
                    placeholder="password"
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Use your own SMTP server for direct control over email sending.
              </div>
            </TabsContent>
            
            <TabsContent value="gmail" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gmailClientId">Gmail Client ID</Label>
                <Input
                  id="gmailClientId"
                  placeholder="client_id"
                  value={gmailClientId}
                  onChange={(e) => setGmailClientId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gmailClientSecret">Gmail Client Secret</Label>
                <Input
                  id="gmailClientSecret"
                  placeholder="client_secret"
                  type="password"
                  value={gmailClientSecret}
                  onChange={(e) => setGmailClientSecret(e.target.value)}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                Use Gmail's OAuth2 integration for secure access to your Gmail account.
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        {showTestEmail ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-center space-x-4">
              <Input
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <Button onClick={handleSendTestEmail} disabled={sendTestEmailMutation.isPending}>
                {sendTestEmailMutation.isPending ? 'Sending...' : 'Send'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowTestEmail(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <div className="flex space-x-2">
          <Button 
            variant="default" 
            onClick={handleSaveSettings}
            disabled={saveSettingsMutation.isPending}
          >
            {saveSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
          
          {emailSettings?.configured && (
            <Button 
              variant="outline" 
              onClick={() => setShowTestEmail(true)}
              disabled={!emailSettings?.configured || showTestEmail}
            >
              Send Test Email
            </Button>
          )}
        </div>
        
        {emailSettings?.configured && !emailSettings?.verified && (
          <Button 
            variant="outline" 
            onClick={handleVerifySettings}
            disabled={verifySettingsMutation.isPending}
          >
            {verifySettingsMutation.isPending ? 'Verifying...' : 'Verify Settings'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}