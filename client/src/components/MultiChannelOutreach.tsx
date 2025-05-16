import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Mail, MessageSquare, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import EmailOutreachForm from './EmailOutreachForm';
import SocialOutreachForm from './SocialOutreachForm';
import ContactFormOutreachForm from './ContactFormOutreachForm';

interface ContactInfo {
  emails?: string[];
  socialProfiles?: Array<{
    platform: string;
    url: string;
    username: string;
    displayName?: string;
  }>;
  contactForms?: string[];
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
  const [activeTab, setActiveTab] = useState(() => {
    // Default to the first available contact method
    if (contactInfo.emails && contactInfo.emails.length > 0) return 'email';
    if (contactInfo.socialProfiles && contactInfo.socialProfiles.length > 0) return 'social';
    if (contactInfo.contactForms && contactInfo.contactForms.length > 0) return 'form';
    return 'email'; // Default fallback
  });

  // Group social profiles by platform
  const socialPlatforms = contactInfo.socialProfiles
    ? [...new Set(contactInfo.socialProfiles.map(profile => profile.platform))]
    : [];

  return (
    <Card className="p-6">
      <Tabs
        defaultValue={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Contact Methods</h3>
          <TabsList>
            {contactInfo.emails && contactInfo.emails.length > 0 && (
              <TabsTrigger value="email" className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Email</span>
                <Badge variant="outline" className="ml-1">
                  {contactInfo.emails.length}
                </Badge>
              </TabsTrigger>
            )}
            
            {contactInfo.socialProfiles && contactInfo.socialProfiles.length > 0 && (
              <TabsTrigger value="social" className="flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Social</span>
                <Badge variant="outline" className="ml-1">
                  {socialPlatforms.length}
                </Badge>
              </TabsTrigger>
            )}
            
            {contactInfo.contactForms && contactInfo.contactForms.length > 0 && (
              <TabsTrigger value="form" className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Contact Form</span>
                <Badge variant="outline" className="ml-1">
                  {contactInfo.contactForms.length}
                </Badge>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Email outreach form */}
        {contactInfo.emails && contactInfo.emails.length > 0 && (
          <TabsContent value="email" className="space-y-4 pt-2">
            <EmailOutreachForm
              opportunityId={opportunityId}
              emails={contactInfo.emails}
              domain={domain}
              websiteName={websiteName}
              onSuccess={onMessageSent}
            />
          </TabsContent>
        )}

        {/* Social media outreach options */}
        {contactInfo.socialProfiles && contactInfo.socialProfiles.length > 0 && (
          <TabsContent value="social" className="space-y-4 pt-2">
            <SocialOutreachForm
              opportunityId={opportunityId}
              socialProfiles={contactInfo.socialProfiles}
              domain={domain}
              websiteName={websiteName}
              onSuccess={onMessageSent}
            />
          </TabsContent>
        )}

        {/* Contact form outreach */}
        {contactInfo.contactForms && contactInfo.contactForms.length > 0 && (
          <TabsContent value="form" className="space-y-4 pt-2">
            <ContactFormOutreachForm
              opportunityId={opportunityId}
              contactForms={contactInfo.contactForms}
              domain={domain}
              websiteName={websiteName}
              onSuccess={onMessageSent}
            />
          </TabsContent>
        )}
      </Tabs>
    </Card>
  );
}