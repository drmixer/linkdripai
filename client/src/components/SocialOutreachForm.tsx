import { useState } from 'react';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Save, Linkedin, Twitter, Facebook, Instagram } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
  onSuccess?: () => void;
}

// Form validation schema
const formSchema = z.object({
  platform: z.string().min(1, "Please select a platform"),
  profileUrl: z.string().url("Please enter a valid URL"),
  message: z.string().min(10, "Message must be at least 10 characters"),
  templateId: z.string().optional(),
  scheduledFor: z.string().optional(),
});

export default function SocialOutreachForm({ 
  opportunityId, 
  socialProfiles,
  domain, 
  websiteName,
  onSuccess
}: SocialOutreachFormProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const queryClient = useQueryClient();
  
  // Fetch available templates
  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['/api/outreach-templates', 'social'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/outreach-templates?channel=social`);
      const data = await response.json();
      return data;
    },
    enabled: false // We'll fetch these on demand
  });
  
  // Form setup
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      platform: socialProfiles.length > 0 ? socialProfiles[0].platform : "",
      profileUrl: socialProfiles.length > 0 ? socialProfiles[0].url : "",
      message: getDefaultMessage(websiteName),
      templateId: "",
      scheduledFor: "",
    },
  });
  
  // Send social outreach message mutation
  const { mutate: sendSocialMessage, isPending } = useMutation({
    mutationFn: async (formData: z.infer<typeof formSchema>) => {
      const response = await apiRequest('POST', `/api/outreach/social/${opportunityId}`, {
        ...formData,
        templateId: formData.templateId ? parseInt(formData.templateId) : undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      // Reset form, invalidate queries and call success callback
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/outreach-history', opportunityId] });
      if (onSuccess) onSuccess();
    },
  });
  
  // Apply template mutation
  const { mutate: applyTemplate, isPending: isApplyingTemplate } = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await apiRequest('GET', `/api/outreach-templates/${templateId}`);
      return response.json();
    },
    onSuccess: (data) => {
      // Update form with template data
      form.setValue('message', data.content);
    },
  });
  
  // Handler for form submission
  function onSubmit(values: z.infer<typeof formSchema>) {
    sendSocialMessage(values);
  }
  
  // Handler for platform selection
  function handlePlatformChange(platform: string) {
    setSelectedPlatform(platform);
    
    // Find the selected profile
    const selectedProfile = socialProfiles.find(profile => profile.platform === platform);
    
    if (selectedProfile) {
      form.setValue('platform', platform);
      form.setValue('profileUrl', selectedProfile.url);
      
      // Adjust message for the platform (character limits, etc.)
      if (platform === 'twitter') {
        const twitterMessage = getTwitterSpecificMessage(websiteName);
        form.setValue('message', twitterMessage);
      } else {
        form.setValue('message', getDefaultMessage(websiteName));
      }
    }
  }
  
  // Handler for template selection
  function handleTemplateChange(templateId: string) {
    form.setValue('templateId', templateId);
    
    if (templateId) {
      applyTemplate(templateId);
    }
  }
  
  // Generate default message
  function getDefaultMessage(websiteName: string): string {
    return `Hi there,

I recently came across your website ${websiteName} and I'm impressed with your content. I have a resource that would be a perfect fit for your audience interested in [TOPIC].

Would you be interested in a potential collaboration?

Thanks!
[Your Name]`;
  }
  
  // Generate Twitter-specific message (shorter)
  function getTwitterSpecificMessage(websiteName: string): string {
    return `Hi! Loved your work on ${websiteName}! I created a resource on [TOPIC] that complements your content perfectly. Would love to collaborate!`;
  }
  
  // Get platform icon
  function getPlatformIcon(platform: string) {
    switch (platform.toLowerCase()) {
      case 'linkedin':
        return <Linkedin className="h-5 w-5" />;
      case 'twitter':
        return <Twitter className="h-5 w-5" />;
      case 'facebook':
        return <Facebook className="h-5 w-5" />;
      case 'instagram':
        return <Instagram className="h-5 w-5" />;
      default:
        return <ExternalLink className="h-5 w-5" />;
    }
  }
  
  // Character limit based on platform
  function getCharacterLimit(platform: string): number {
    switch (platform.toLowerCase()) {
      case 'twitter':
        return 280;
      case 'linkedin':
        return 1300;
      case 'instagram':
        return 2200;
      case 'facebook':
        return 5000;
      default:
        return 2000;
    }
  }

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Platform selection */}
          <FormField
            control={form.control}
            name="platform"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Social Platform</FormLabel>
                <Select 
                  onValueChange={(value) => {
                    field.onChange(value);
                    handlePlatformChange(value);
                  }}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {socialProfiles.map((profile, index) => (
                      <SelectItem key={index} value={profile.platform}>
                        <div className="flex items-center">
                          {getPlatformIcon(profile.platform)}
                          <span className="ml-2 capitalize">{profile.platform}</span>
                          {profile.username && (
                            <span className="ml-2 text-muted-foreground">({profile.username})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Profile URL */}
          <FormField
            control={form.control}
            name="profileUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profile URL</FormLabel>
                <div className="flex space-x-2">
                  <FormControl>
                    <Input 
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(field.value, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Template selection (if available) */}
          {!isLoadingTemplates && templates && templates.length > 0 && (
            <FormField
              control={form.control}
              name="templateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message Template</FormLabel>
                  <Select 
                    onValueChange={handleTemplateChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">No template</SelectItem>
                      {templates.map((template: any) => (
                        <SelectItem key={template.id} value={template.id.toString()}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          
          {/* Message */}
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <Textarea 
                      placeholder="Your message"
                      rows={6}
                      {...field}
                      disabled={isPending}
                      maxLength={selectedPlatform ? getCharacterLimit(selectedPlatform) : undefined}
                    />
                    
                    {selectedPlatform && (
                      <div className="text-xs text-right text-muted-foreground">
                        {field.value.length} / {getCharacterLimit(selectedPlatform)} characters
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Schedule option (if needed) */}
          <FormField
            control={form.control}
            name="scheduledFor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Schedule (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    type="datetime-local"
                    {...field}
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Submit and other buttons */}
          <div className="flex space-x-2">
            <Button 
              type="submit" 
              disabled={isPending || isApplyingTemplate}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  {selectedPlatform && getPlatformIcon(selectedPlatform)}
                  <span className="ml-2">Send Message</span>
                </>
              )}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open(form.getValues().profileUrl, '_blank')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Visit Profile
            </Button>
            
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                // Save as a template logic would go here
                console.log("Save as template");
              }}
              disabled={isPending || isApplyingTemplate}
            >
              <Save className="mr-2 h-4 w-4" />
              Save as Template
            </Button>
          </div>
        </form>
      </Form>
      
      {/* Platform-specific tips */}
      {selectedPlatform && (
        <div className="mt-4 p-3 bg-muted rounded-md">
          <h4 className="text-sm font-medium mb-2">Tips for {selectedPlatform} outreach:</h4>
          <ul className="text-sm space-y-1 list-disc pl-5">
            {selectedPlatform.toLowerCase() === 'linkedin' && (
              <>
                <li>Personalize your message with specific references to their work</li>
                <li>Keep it professional and concise</li>
                <li>Clearly explain the mutual benefit of the collaboration</li>
                <li>Include your credentials to establish credibility</li>
              </>
            )}
            
            {selectedPlatform.toLowerCase() === 'twitter' && (
              <>
                <li>Keep messages under 280 characters</li>
                <li>Be direct and get to the point quickly</li>
                <li>Consider starting with engagement on their tweets first</li>
                <li>Use a friendly, conversational tone</li>
              </>
            )}
            
            {selectedPlatform.toLowerCase() === 'facebook' && (
              <>
                <li>Send a friend request before messaging if their profile is private</li>
                <li>Introduce yourself clearly</li>
                <li>Reference mutual connections if any exist</li>
                <li>Be respectful of their personal space</li>
              </>
            )}
            
            {selectedPlatform.toLowerCase() === 'instagram' && (
              <>
                <li>Start by engaging with their content</li>
                <li>Keep DMs brief and friendly</li>
                <li>Include your website or portfolio link</li>
                <li>Consider offering a collaboration idea in the first message</li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}