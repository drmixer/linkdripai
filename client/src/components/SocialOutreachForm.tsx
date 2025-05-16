import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, ExternalLink, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { FaTwitter, FaLinkedin, FaFacebook, FaInstagram } from 'react-icons/fa';

// Define form validation schema
const formSchema = z.object({
  profileUrl: z.string().url('Please enter a valid URL'),
  message: z.string().min(20, 'Message must be at least 20 characters'),
});

interface SocialProfile {
  platform: string;
  url: string;
  username: string;
  displayName?: string;
}

interface SocialOutreachFormProps {
  opportunityId: number;
  socialProfiles: SocialProfile[];
  domain: string;
  websiteName: string;
  onSuccess?: () => void;
}

export default function SocialOutreachForm({
  opportunityId,
  socialProfiles,
  domain,
  websiteName,
  onSuccess
}: SocialOutreachFormProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState('');
  const [selectedProfileIndex, setSelectedProfileIndex] = useState(socialProfiles.length > 0 ? '0' : '');
  
  // Get templates for social messages
  const { data: templates = [] } = useQuery({
    queryKey: ['/api/social-templates'],
    enabled: socialProfiles.length > 0,
  });
  
  // Form definition with default values
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      profileUrl: socialProfiles.length > 0 ? socialProfiles[0].url : '',
      message: socialProfiles.length > 0 
        ? getDefaultMessage(websiteName, socialProfiles[0].platform) 
        : '',
    },
  });

  // Record social outreach mutation
  const recordOutreachMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const profile = socialProfiles[parseInt(selectedProfileIndex)];
      const response = await apiRequest('POST', '/api/outreach/social', {
        ...values,
        opportunityId,
        platform: profile.platform,
        domain,
        websiteName,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Outreach recorded',
        description: 'Your social media outreach has been recorded',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/outreach/history'] });
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to record outreach',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Submit handler
  function onSubmit(values: z.infer<typeof formSchema>) {
    recordOutreachMutation.mutate(values);
  }

  // Handle profile selection change
  function handleProfileSelect(profileIndex: string) {
    setSelectedProfileIndex(profileIndex);
    const profile = socialProfiles[parseInt(profileIndex)];
    form.setValue('profileUrl', profile.url);
    form.setValue('message', getDefaultMessage(websiteName, profile.platform));
  }

  // Copy text to clipboard
  function copyToClipboard(text: string, type: string) {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(''), 2000);
  }

  // Generate a default message template based on platform
  function getDefaultMessage(websiteName: string, platform: string): string {
    // Find an appropriate template based on the platform
    const template = templates.find(t => 
      t.platform === platform || t.platform === 'any'
    );
    
    if (template) {
      return template.content.replace(/{{website}}/g, websiteName);
    }
    
    return `Hi there! I came across ${websiteName} and really enjoyed your content. I run a website in a similar niche, and I think we could potentially collaborate. I've recently published content that your audience might find valuable. Would you be interested in checking it out for a potential mention?`;
  }

  // Get appropriate icon based on platform
  function getPlatformIcon(platform: string) {
    switch (platform.toLowerCase()) {
      case 'twitter':
        return <FaTwitter className="h-4 w-4 text-blue-400" />;
      case 'linkedin':
        return <FaLinkedin className="h-4 w-4 text-blue-700" />;
      case 'facebook':
        return <FaFacebook className="h-4 w-4 text-blue-600" />;
      case 'instagram':
        return <FaInstagram className="h-4 w-4 text-pink-600" />;
      default:
        return <MessageSquare className="h-4 w-4 text-gray-500" />;
    }
  }

  if (socialProfiles.length === 0) {
    return (
      <div className="p-6 text-center bg-gray-50 rounded-lg border border-gray-200">
        <MessageSquare className="h-6 w-6 text-gray-400 mx-auto mb-2" />
        <h3 className="text-lg font-medium mb-2">No Social Media Profiles Found</h3>
        <p className="text-gray-500 mb-4">
          No social media profiles were found for this opportunity.
        </p>
        <p className="text-sm text-gray-500">
          Try reaching out through other contact methods like email or contact forms.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-medium">Social Media Outreach</h3>
      </div>
      
      {/* Profile selection */}
      <div className="mb-6">
        <FormLabel>Select a social profile:</FormLabel>
        <Select 
          value={selectedProfileIndex}
          onValueChange={handleProfileSelect}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a social profile" />
          </SelectTrigger>
          <SelectContent>
            {socialProfiles.map((profile, index) => (
              <SelectItem key={profile.url} value={index.toString()}>
                <div className="flex items-center gap-2">
                  {getPlatformIcon(profile.platform)}
                  <span className="capitalize">{profile.platform}</span>
                  {profile.username && <span className="text-gray-500 text-sm">({profile.username})</span>}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selected profile */}
      {selectedProfileIndex !== '' && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium flex items-center gap-2">
              {getPlatformIcon(socialProfiles[parseInt(selectedProfileIndex)].platform)}
              <span className="capitalize">{socialProfiles[parseInt(selectedProfileIndex)].platform}</span>
              {socialProfiles[parseInt(selectedProfileIndex)].displayName && 
                <span className="text-gray-600 text-sm ml-1">
                  ({socialProfiles[parseInt(selectedProfileIndex)].displayName})
                </span>
              }
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center text-xs"
                onClick={() => copyToClipboard(socialProfiles[parseInt(selectedProfileIndex)].url, 'profile')}
              >
                {copied === 'profile' ? (
                  <>Copied <Check className="h-3 w-3 ml-1" /></>
                ) : (
                  <>Copy URL <Copy className="h-3 w-3 ml-1" /></>
                )}
              </Button>
              <a
                href={socialProfiles[parseInt(selectedProfileIndex)].url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded-md"
              >
                Open Profile <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded-md text-sm break-all">
            {socialProfiles[parseInt(selectedProfileIndex)].url}
          </div>
        </div>
      )}

      {/* Message form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                <FormControl>
                  <div className="flex">
                    <Textarea
                      placeholder="Your message"
                      className="min-h-[200px] flex-1"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="ml-2 self-start"
                      onClick={() => copyToClipboard(field.value, 'message')}
                    >
                      {copied === 'message' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={recordOutreachMutation.isPending}
            >
              {recordOutreachMutation.isPending ? (
                'Recording...'
              ) : (
                'Record Social Outreach'
              )}
            </Button>
          </div>
        </form>
      </Form>
      
      {/* Tips */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2">Social Media Outreach Tips</h4>
          <ul className="text-sm text-gray-600 space-y-2 list-disc pl-4">
            <li>Personalize your message to show you've actually looked at their content</li>
            <li>Keep messages concise - social media platforms often have character limits</li>
            <li>Be clear about what you're requesting but don't be overly promotional</li>
            <li>Offer something of value in return for consideration</li>
            <li>For LinkedIn, connect first before sending a detailed message</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}