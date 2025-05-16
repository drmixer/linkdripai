import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  MessageSquare, 
  Linkedin, 
  Twitter, 
  Facebook, 
  Phone,
  Instagram,
  ExternalLink,
  CheckCircle,
  Clock,
  AlertTriangle,
  Send
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import EmailOutreachForm from "./EmailOutreachForm";
import SocialOutreachForm from "./SocialOutreachForm";
import ContactFormOutreachForm from "./ContactFormOutreachForm";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Define types for contact information
interface ContactInfo {
  emails: string[];
  socialProfiles: Array<{
    platform: string;
    url: string;
    username: string;
  }>;
  contactForms: string[];
  extractionDetails?: {
    normalized: boolean;
    source: string;
    version: string;
    lastUpdated: string;
  };
}

interface OutreachHistoryItem {
  id: number;
  channel: string;
  status: string;
  sentAt: string;
  subject?: string;
}

interface MultiChannelOutreachProps {
  opportunityId: number;
  contactInfo: ContactInfo;
  domain: string;
  websiteName: string;
  onMessageSent?: () => void;
}

export default function MultiChannelOutreach({ 
  opportunityId, 
  contactInfo, 
  domain, 
  websiteName,
  onMessageSent 
}: MultiChannelOutreachProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("email");
  
  // Fetch outreach history
  const { data: outreachHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['/api/outreach-history', opportunityId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/outreach-history/${opportunityId}`);
      const data = await response.json();
      return data as OutreachHistoryItem[];
    }
  });

  // Determine available channels and set initial active tab
  useEffect(() => {
    const availableChannels: string[] = [];
    
    if (contactInfo.emails && contactInfo.emails.length > 0) {
      availableChannels.push('email');
    }
    
    if (contactInfo.socialProfiles && contactInfo.socialProfiles.length > 0) {
      availableChannels.push('social');
    }
    
    if (contactInfo.contactForms && contactInfo.contactForms.length > 0) {
      availableChannels.push('form');
    }
    
    // Set the first available channel as active
    if (availableChannels.length > 0 && !availableChannels.includes(activeTab)) {
      setActiveTab(availableChannels[0]);
    }
  }, [contactInfo, activeTab]);

  // Render contact method icons with counts
  const renderContactMethodIcons = () => {
    return (
      <div className="flex space-x-2 items-center">
        {contactInfo.emails && contactInfo.emails.length > 0 && (
          <Badge variant="outline" className="flex items-center gap-1 py-1">
            <Mail className="h-3 w-3" />
            <span>{contactInfo.emails.length}</span>
          </Badge>
        )}
        
        {contactInfo.socialProfiles && contactInfo.socialProfiles.length > 0 && (
          <Badge variant="outline" className="flex items-center gap-1 py-1">
            <Linkedin className="h-3 w-3" />
            <span>{contactInfo.socialProfiles.length}</span>
          </Badge>
        )}
        
        {contactInfo.contactForms && contactInfo.contactForms.length > 0 && (
          <Badge variant="outline" className="flex items-center gap-1 py-1">
            <MessageSquare className="h-3 w-3" />
            <span>{contactInfo.contactForms.length}</span>
          </Badge>
        )}
      </div>
    );
  };

  // Render outreach history
  const renderOutreachHistory = () => {
    if (isLoadingHistory) {
      return <div className="text-sm text-muted-foreground">Loading history...</div>;
    }
    
    if (!outreachHistory || outreachHistory.length === 0) {
      return <div className="text-sm text-muted-foreground">No previous outreach.</div>;
    }
    
    return (
      <div className="space-y-2 mt-2">
        <h4 className="text-sm font-medium">Recent Activity</h4>
        {outreachHistory.slice(0, 3).map((item) => (
          <div key={item.id} className="flex items-center justify-between text-sm border-b pb-1">
            <div className="flex items-center gap-2">
              {getChannelIcon(item.channel)}
              <span className="truncate max-w-[140px]">{item.subject || getChannelName(item.channel)}</span>
            </div>
            <div className="flex items-center gap-1">
              {getStatusIcon(item.status)}
              <span className="text-xs text-muted-foreground">
                {new Date(item.sentAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
        {outreachHistory.length > 3 && (
          <Button variant="link" className="text-xs p-0 h-auto" onClick={() => setActiveTab("history")}>
            View all history
          </Button>
        )}
      </div>
    );
  };

  // Helper functions for icons
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'linkedin':
        return <Linkedin className="h-4 w-4" />;
      case 'twitter':
        return <Twitter className="h-4 w-4" />;
      case 'facebook':
        return <Facebook className="h-4 w-4" />;
      case 'instagram':
        return <Instagram className="h-4 w-4" />;
      case 'contact_form':
        return <MessageSquare className="h-4 w-4" />;
      case 'phone':
        return <Phone className="h-4 w-4" />;
      default:
        return <ExternalLink className="h-4 w-4" />;
    }
  };

  const getChannelName = (channel: string) => {
    switch (channel) {
      case 'email':
        return 'Email';
      case 'linkedin':
        return 'LinkedIn';
      case 'twitter':
        return 'Twitter';
      case 'facebook':
        return 'Facebook';
      case 'instagram':
        return 'Instagram';
      case 'contact_form':
        return 'Contact Form';
      case 'phone':
        return 'Phone';
      default:
        return 'Other';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Send className="h-3 w-3 text-blue-500" />;
      case 'delivered':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'opened':
        return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'replied':
        return <CheckCircle className="h-3 w-3 text-green-700" />;
      case 'scheduled':
        return <Clock className="h-3 w-3 text-amber-500" />;
      case 'failed':
      case 'bounced':
        return <AlertTriangle className="h-3 w-3 text-red-500" />;
      default:
        return <Clock className="h-3 w-3 text-gray-500" />;
    }
  };

  const handleSuccessfulOutreach = () => {
    toast({
      title: "Outreach sent successfully!",
      description: "Your message has been sent.",
    });
    
    if (onMessageSent) {
      onMessageSent();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Contact {websiteName}</CardTitle>
            <CardDescription>{domain}</CardDescription>
          </div>
          {renderContactMethodIcons()}
        </div>
      </CardHeader>
      
      <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          {contactInfo.emails && contactInfo.emails.length > 0 && (
            <TabsTrigger value="email" className="flex-1">
              <Mail className="mr-2 h-4 w-4" />
              Email
            </TabsTrigger>
          )}
          
          {contactInfo.socialProfiles && contactInfo.socialProfiles.length > 0 && (
            <TabsTrigger value="social" className="flex-1">
              <Linkedin className="mr-2 h-4 w-4" />
              Social
            </TabsTrigger>
          )}
          
          {contactInfo.contactForms && contactInfo.contactForms.length > 0 && (
            <TabsTrigger value="form" className="flex-1">
              <MessageSquare className="mr-2 h-4 w-4" />
              Form
            </TabsTrigger>
          )}
          
          <TabsTrigger value="history" className="flex-1">
            <Clock className="mr-2 h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>
        
        <CardContent className="pt-4">
          {contactInfo.emails && contactInfo.emails.length > 0 && (
            <TabsContent value="email">
              <EmailOutreachForm 
                opportunityId={opportunityId}
                emails={contactInfo.emails}
                domain={domain}
                websiteName={websiteName}
                onSuccess={handleSuccessfulOutreach}
              />
            </TabsContent>
          )}
          
          {contactInfo.socialProfiles && contactInfo.socialProfiles.length > 0 && (
            <TabsContent value="social">
              <SocialOutreachForm 
                opportunityId={opportunityId}
                socialProfiles={contactInfo.socialProfiles}
                domain={domain}
                websiteName={websiteName}
                onSuccess={handleSuccessfulOutreach}
              />
            </TabsContent>
          )}
          
          {contactInfo.contactForms && contactInfo.contactForms.length > 0 && (
            <TabsContent value="form">
              <ContactFormOutreachForm 
                opportunityId={opportunityId}
                contactForms={contactInfo.contactForms}
                domain={domain}
                websiteName={websiteName}
                onSuccess={handleSuccessfulOutreach}
              />
            </TabsContent>
          )}
          
          <TabsContent value="history">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Outreach History</h3>
              {isLoadingHistory ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading outreach history...</p>
                </div>
              ) : !outreachHistory || outreachHistory.length === 0 ? (
                <div className="text-center py-8 border rounded-md">
                  <p className="text-muted-foreground">No outreach history found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {outreachHistory.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-md">
                      <div className="flex items-center gap-2">
                        {getChannelIcon(item.channel)}
                        <div>
                          <div className="font-medium">{item.subject || getChannelName(item.channel)}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(item.sentAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <Badge variant={item.status === 'failed' || item.status === 'bounced' ? 'destructive' : 
                             item.status === 'delivered' || item.status === 'opened' || item.status === 'replied' ? 
                             'success' : 'secondary'}>
                        {item.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </CardContent>
        
        <CardFooter className="pt-0 flex flex-col items-start">
          {renderOutreachHistory()}
        </CardFooter>
      </Tabs>
    </Card>
  );
}