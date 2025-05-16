import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, SendIcon, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

// Form validation schema
const formSchema = z.object({
  profileUrl: z.string().url('Please enter a valid URL'),
  platform: z.string().min(1, 'Please select a platform'),
  message: z.string().min(30, 'Message must be at least 30 characters'),
});

type FormValues = z.infer<typeof formSchema>;

interface SocialProfile {
  platform: string;
  url: string;
  username: string;
}

interface SocialOutreachFormProps {
  opportunityId: number;
  socialProfiles: SocialProfile[];
  domain: string;
  websiteName: string;
}

export default function SocialOutreachForm({ 
  opportunityId, 
  socialProfiles = [], 
  domain, 
  websiteName
}: SocialOutreachFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [sendingStatus, setSendingStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  
  // Get platform icon
  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'twitter':
      case 'x':
        return '𝕏';
      case 'facebook':
        return 'ƒ';
      case 'linkedin':
        return 'in';
      case 'instagram':
        return '📷';
      case 'pinterest':
        return '📌';
      case 'github':
        return '🔧';
      case 'youtube':
        return '▶️';
      default:
        return '🔗';
    }
  };

  // Get platform color
  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'twitter':
      case 'x':
        return 'bg-blue-500';
      case 'facebook':
        return 'bg-blue-600';
      case 'linkedin':
        return 'bg-blue-700';
      case 'instagram':
        return 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500';
      case 'pinterest':
        return 'bg-red-600';
      case 'github':
        return 'bg-gray-800';
      case 'youtube':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Set up the form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      profileUrl: socialProfiles.length > 0 ? socialProfiles[0].url : '',
      platform: socialProfiles.length > 0 ? socialProfiles[0].platform : '',
      message: `Hi there! I came across ${websiteName || domain} and was impressed with your content. I'd love to discuss a possible collaboration that could benefit both our audiences. Could we connect to discuss this further?`,
    },
  });

  // Fetch message templates
  const { data: templates } = useQuery({
    queryKey: ['/api/message-templates'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Track profile selection to update platform
  const selectedProfileUrl = form.watch('profileUrl');
  const selectedProfile = socialProfiles.find(profile => profile.url === selectedProfileUrl);
  if (selectedProfile && selectedProfile.platform !== form.getValues('platform')) {
    form.setValue('platform', selectedProfile.platform);
  }

  // Submit outreach message
  const socialOutreachMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      setSendingStatus('sending');
      const response = await apiRequest('POST', '/api/outreach/social', {
        opportunityId,
        platform: values.platform,
        profileUrl: values.profileUrl,
        message: values.message,
      });
      return response.json();
    },
    onSuccess: () => {
      setSendingStatus('success');
      toast({
        title: 'Message prepared',
        description: 'Your outreach message has been prepared. Use the link to visit the profile and send it.',
        variant: 'default',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/opportunities/${opportunityId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/outreach/history'] });
    },
    onError: (error: Error) => {
      setSendingStatus('error');
      toast({
        title: 'Failed to prepare message',
        description: error.message || 'There was an error preparing your message. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Handle form submission
  const onSubmit = (values: FormValues) => {
    socialOutreachMutation.mutate(values);
  };

  // Open the profile URL in a new tab
  const openProfileUrl = () => {
    if (selectedProfileUrl) {
      window.open(selectedProfileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Social Media Outreach</CardTitle>
        <CardDescription>
          Connect through social media channels
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="profileUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Social Profile</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a social profile" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {socialProfiles.map((profile) => (
                        <SelectItem key={profile.url} value={profile.url}>
                          <div className="flex items-center">
                            <span className="mr-2 text-sm font-semibold">
                              {getPlatformIcon(profile.platform)}
                            </span>
                            <span>{profile.platform} - {profile.username || 'Profile'}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose which social media profile to use for outreach
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
                  
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Your message" 
                      className="min-h-[200px]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Keep your message concise and personalized for the platform
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={sendingStatus === 'sending' || socialOutreachMutation.isPending}
              >
                {sendingStatus === 'sending' || socialOutreachMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparing...
                  </>
                ) : sendingStatus === 'success' ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Prepared
                  </>
                ) : sendingStatus === 'error' ? (
                  <>
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Try Again
                  </>
                ) : (
                  <>
                    <SendIcon className="mr-2 h-4 w-4" />
                    Prepare Message
                  </>
                )}
              </Button>
              
              <Button 
                type="button" 
                variant="outline" 
                onClick={openProfileUrl}
                className="flex-1"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Profile
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex-col items-start border-t p-4 bg-gray-50">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Social Outreach Tips</h4>
          <ul className="text-sm space-y-1 text-gray-600 list-disc list-inside">
            <li>Be professional and friendly in your initial message</li>
            <li>Mention that you've visited their website and what impressed you</li>
            <li>Keep your message concise and appropriate for the platform</li>
            <li>Follow platform-specific etiquette (e.g., LinkedIn is more formal than Twitter)</li>
          </ul>
        </div>
      </CardFooter>
    </Card>
  );
}