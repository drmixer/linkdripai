import { useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import MultiChannelOutreach from '@/components/MultiChannelOutreach';
import Layout from '@/components/layout';
import { useAuth } from '@/hooks/use-auth';

/**
 * Multi-Channel Outreach Page
 * 
 * This page provides a comprehensive interface for reaching out to a specific opportunity
 * through multiple channels: email, social media, and contact forms.
 */
export default function MultiChannelOutreachPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const opportunityId = params?.id ? parseInt(params.id) : undefined;
  
  // Get opportunity details to display the name and confirm it exists
  const { data: opportunity, isLoading, error } = useQuery({
    queryKey: opportunityId ? [`/api/opportunities/${opportunityId}`] : null,
    enabled: !!opportunityId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Redirect to opportunities page if user is not authenticated
  useEffect(() => {
    if (!user) {
      setLocation('/auth');
    }
  }, [user, setLocation]);

  // Handle missing opportunity ID in URL
  if (!opportunityId) {
    return (
      <div className="container py-10">
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-amber-700">Missing Information</CardTitle>
            </div>
            <CardDescription className="text-amber-600">
              No opportunity ID was provided. Please select an opportunity from your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="mt-2" 
              onClick={() => setLocation('/opportunities')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Opportunities
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="container py-10 flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-xl font-medium">Loading Outreach Options...</h2>
          <p className="text-gray-500 mt-2">Preparing your outreach channels</p>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="container py-10">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <CardTitle className="text-red-700">Error Loading Opportunity</CardTitle>
            </div>
            <CardDescription className="text-red-600">
              We couldn't load the opportunity details. The opportunity may have been deleted or you may not have access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600 mb-4">Error details: {(error as Error).message}</p>
            <Button 
              variant="outline" 
              onClick={() => setLocation('/opportunities')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Opportunities
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle non-existent opportunity
  if (!opportunity) {
    return (
      <div className="container py-10">
        <Card>
          <CardHeader>
            <CardTitle>Opportunity Not Found</CardTitle>
            <CardDescription>
              The opportunity you're looking for doesn't exist or has been removed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              onClick={() => setLocation('/opportunities')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Opportunities
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="mb-6">
        <Button 
          variant="outline" 
          onClick={() => setLocation('/opportunities')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Opportunities
        </Button>
      </div>
      
      <MultiChannelOutreach opportunityId={opportunityId} />
      
      <div className="mt-10">
        <Card>
          <CardHeader>
            <CardTitle>Outreach Best Practices</CardTitle>
            <CardDescription>
              Tips for successful outreach and relationship building
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-base mb-1">Personalize Your Message</h3>
                <p className="text-sm text-gray-600">
                  Take time to understand the website's content and audience. Reference specific articles or content
                  to show you've done your research.
                </p>
              </div>
              
              <div>
                <h3 className="font-medium text-base mb-1">Provide Clear Value</h3>
                <p className="text-sm text-gray-600">
                  Clearly explain how your content will benefit their audience. Focus on the value exchange rather than
                  just asking for a link.
                </p>
              </div>
              
              <div>
                <h3 className="font-medium text-base mb-1">Follow Up (But Don't Spam)</h3>
                <p className="text-sm text-gray-600">
                  If you don't receive a response after a week, a single follow-up is appropriate. Be polite and
                  understanding of their busy schedule.
                </p>
              </div>
              
              <div>
                <h3 className="font-medium text-base mb-1">Build a Relationship</h3>
                <p className="text-sm text-gray-600">
                  Approach outreach as the start of a potential long-term relationship, not just a transactional
                  link-building exercise.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}