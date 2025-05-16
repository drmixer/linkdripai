import { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  Card, 
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Mail, Link2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import MultiChannelOutreach from '@/components/MultiChannelOutreach';

export default function MultiChannelOutreachPage() {
  const { id } = useParams();
  const opportunityId = parseInt(id || '0');
  const [activeTab, setActiveTab] = useState('contact');

  // Fetch opportunity details
  const { data: opportunity, isLoading, error } = useQuery({
    queryKey: ['/api/opportunities', opportunityId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/opportunities/${opportunityId}`);
      return response.json();
    },
    enabled: !!opportunityId,
  });

  // Format domain authority for display
  const formatDomainAuthority = (da: string | number | null | undefined) => {
    if (da === null || da === undefined) return 'N/A';
    return typeof da === 'string' ? da : Math.round(da);
  };

  // Format spam score for display
  const formatSpamScore = (spam: string | number | null | undefined) => {
    if (spam === null || spam === undefined) return 'N/A';
    return typeof spam === 'string' ? spam : Math.round(spam);
  };

  // If loading, show spinner
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If error or no opportunity found
  if (error || !opportunity) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-lg font-medium mb-2">
          {error ? 'Error loading opportunity' : 'Opportunity not found'}
        </div>
        <Button asChild>
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to Dashboard
          </Link>
        </Button>
      </div>
    );
  }

  // Prepare contact info for the MultiChannelOutreach component
  const contactInfo = {
    emails: opportunity.contactInfo?.emails || [],
    socialProfiles: opportunity.contactInfo?.socialProfiles || [],
    contactForms: opportunity.contactInfo?.contactForms || [],
  };

  // Check if we have any contact methods
  const hasContactMethods = 
    contactInfo.emails.length > 0 || 
    contactInfo.socialProfiles.length > 0 || 
    contactInfo.contactForms.length > 0;

  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-6">
      {/* Header navigation */}
      <div className="flex justify-between items-center">
        <Link href="/">
          <Button variant="ghost" className="flex items-center">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Opportunities
          </Button>
        </Link>
      </div>

      {/* Opportunity details */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{opportunity.pageTitle || opportunity.domain}</CardTitle>
              <CardDescription className="flex items-center mt-1">
                <a 
                  href={opportunity.url} 
                  target="_blank"
                  rel="noopener noreferrer" 
                  className="text-blue-500 hover:underline flex items-center"
                >
                  {opportunity.url}
                  <Link2 className="ml-1 h-3 w-3" />
                </a>
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="flex items-center gap-1 py-1">
                DA {formatDomainAuthority(opportunity.domainAuthority)}
              </Badge>
              <Badge variant={parseInt(formatSpamScore(opportunity.spamScore)) > 30 ? "destructive" : "outline"} className="flex items-center gap-1 py-1">
                Spam {formatSpamScore(opportunity.spamScore)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Check if we have contact info */}
            {!hasContactMethods ? (
              <div className="p-6 text-center border rounded-md bg-gray-50">
                <Mail className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <h3 className="text-lg font-medium mb-1">No contact information available</h3>
                <p className="text-gray-500 mb-4">
                  We couldn't find any contact information for this opportunity.
                </p>
                <Button asChild>
                  <Link href="/">
                    Return to Dashboard
                  </Link>
                </Button>
              </div>
            ) : (
              // If we have contact info, show the outreach component
              <MultiChannelOutreach
                opportunityId={opportunityId}
                contactInfo={contactInfo}
                domain={opportunity.domain}
                websiteName={opportunity.pageTitle || opportunity.domain}
                onMessageSent={() => {
                  // Refresh the page or data as needed
                }}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}