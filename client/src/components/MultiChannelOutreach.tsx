import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, MessageSquare, Send, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import EmailOutreachForm from './EmailOutreachForm';
import SocialOutreachForm from './SocialOutreachForm';
import ContactFormOutreachForm from './ContactFormOutreachForm';

interface MultiChannelOutreachProps {
  opportunityId: number;
}

export default function MultiChannelOutreach({ opportunityId }: MultiChannelOutreachProps) {
  const [activeTab, setActiveTab] = useState('email');
  
  // Fetch opportunity details including contact information
  const { data: opportunity, isLoading, error } = useQuery({
    queryKey: [`/api/opportunities/${opportunityId}`],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  useEffect(() => {
    // If a tab has no available contact methods, select the first tab with data
    if (opportunity) {
      const contactInfo = opportunity.contactInfo || {};
      const emails = contactInfo.emails || [];
      const socialProfiles = contactInfo.socialProfiles || [];
      const contactForms = contactInfo.contactForms || [];
      
      // Track available contact methods
      const availableMethods = new Set<string>();
      if (emails.length > 0) availableMethods.add('email');
      if (socialProfiles.length > 0) availableMethods.add('social');
      if (contactForms.length > 0) availableMethods.add('contact-form');
      
      // If current tab has no contact data, switch to first available
      if (!availableMethods.has(activeTab)) {
        for (const method of Array.from(availableMethods)) {
          setActiveTab(method);
          break;
        }
      }
    }
  }, [opportunity, activeTab]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <CardTitle className="text-red-700">Error Loading Opportunity</CardTitle>
          </div>
          <CardDescription className="text-red-600">
            We couldn't load the opportunity details. Please try again later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">Error details: {(error as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!opportunity) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Opportunity Not Found</CardTitle>
          <CardDescription>
            The opportunity you're looking for doesn't exist or has been removed.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Extract contact information from opportunity
  const contactInfo = opportunity.contactInfo || {};
  const emails = contactInfo.emails || [];
  const socialProfiles = contactInfo.socialProfiles || [];
  const contactForms = contactInfo.contactForms || [];
  
  // Calculate contact options coverage
  const hasEmail = emails.length > 0;
  const hasSocial = socialProfiles.length > 0;
  const hasContactForm = contactForms.length > 0;
  const totalOptions = [hasEmail, hasSocial, hasContactForm].filter(Boolean).length;
  const coveragePercent = totalOptions > 0 ? (totalOptions / 3) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Outreach: {opportunity.websiteName || opportunity.domain}</h2>
        <p className="text-gray-500 mb-4">
          Choose your preferred outreach method below. You can track responses in your outreach history.
        </p>
        
        {/* Contact method summary */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Contact Method Coverage</span>
            <span className="text-sm font-medium">{Math.round(coveragePercent)}%</span>
          </div>
          <Progress value={coveragePercent} className="h-2" />
          <div className="flex gap-2 mt-3">
            <Badge variant={hasEmail ? "default" : "outline"} className={hasEmail ? "bg-blue-500" : "text-gray-500"}>
              <Mail className="h-3 w-3 mr-1" /> Email
            </Badge>
            <Badge variant={hasSocial ? "default" : "outline"} className={hasSocial ? "bg-green-500" : "text-gray-500"}>
              <MessageSquare className="h-3 w-3 mr-1" /> Social
            </Badge>
            <Badge variant={hasContactForm ? "default" : "outline"} className={hasContactForm ? "bg-purple-500" : "text-gray-500"}>
              <Send className="h-3 w-3 mr-1" /> Contact Form
            </Badge>
          </div>
        </div>
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="email" disabled={!hasEmail}>
            <Mail className="h-4 w-4 mr-2" /> Email
          </TabsTrigger>
          <TabsTrigger value="social" disabled={!hasSocial}>
            <MessageSquare className="h-4 w-4 mr-2" /> Social Media
          </TabsTrigger>
          <TabsTrigger value="contact-form" disabled={!hasContactForm}>
            <Send className="h-4 w-4 mr-2" /> Contact Form
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="email" className="mt-6">
          {hasEmail ? (
            <EmailOutreachForm 
              opportunityId={opportunityId}
              emails={emails}
              domain={opportunity.domain}
              websiteName={opportunity.websiteName || opportunity.domain}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Email Addresses Available</CardTitle>
                <CardDescription>
                  This opportunity doesn't have any email addresses. Try another contact method.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="social" className="mt-6">
          {hasSocial ? (
            <SocialOutreachForm
              opportunityId={opportunityId}
              socialProfiles={socialProfiles}
              domain={opportunity.domain}
              websiteName={opportunity.websiteName || opportunity.domain}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Social Profiles Available</CardTitle>
                <CardDescription>
                  This opportunity doesn't have any social media profiles. Try another contact method.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="contact-form" className="mt-6">
          {hasContactForm ? (
            <ContactFormOutreachForm
              opportunityId={opportunityId}
              contactForms={contactForms}
              domain={opportunity.domain}
              websiteName={opportunity.websiteName || opportunity.domain}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Contact Forms Available</CardTitle>
                <CardDescription>
                  This opportunity doesn't have any contact forms. Try another contact method.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}