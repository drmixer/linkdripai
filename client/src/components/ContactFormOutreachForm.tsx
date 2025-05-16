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
import { Loader2, MessageSquare, ExternalLink, Save, ClipboardCopy } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ContactFormOutreachFormProps {
  opportunityId: number;
  contactForms: string[];
  domain: string;
  websiteName: string;
  onSuccess?: () => void;
}

// Form validation schema
const formSchema = z.object({
  contactFormUrl: z.string().url("Please select a valid contact form URL"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(20, "Message must be at least 20 characters"),
  yourName: z.string().min(1, "Please enter your name"),
  yourEmail: z.string().email("Please enter a valid email"),
  yourWebsite: z.string().url("Please enter a valid URL for your website"),
  templateId: z.string().optional(),
  notes: z.string().optional(),
});

export default function ContactFormOutreachForm({ 
  opportunityId, 
  contactForms, 
  domain, 
  websiteName,
  onSuccess
}: ContactFormOutreachFormProps) {
  const { toast } = useToast();
  const [copying, setCopying] = useState(false);
  const queryClient = useQueryClient();
  
  // Fetch user profile for defaults
  const { data: userProfile } = useQuery({
    queryKey: ['/api/user/profile'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/user/profile');
        return await response.json();
      } catch (error) {
        // Return empty defaults if API doesn't exist yet
        return {
          name: '',
          email: '',
          website: ''
        };
      }
    }
  });
  
  // Fetch available templates
  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['/api/outreach-templates', 'contact_form'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/outreach-templates?channel=contact_form`);
        return await response.json();
      } catch (error) {
        return [];
      }
    }
  });
  
  // Form setup with defaults if user profile is available
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      contactFormUrl: contactForms.length > 0 ? contactForms[0] : "",
      subject: `Content collaboration opportunity with ${websiteName}`,
      message: getDefaultMessage(websiteName),
      yourName: userProfile?.name || "",
      yourEmail: userProfile?.email || "",
      yourWebsite: userProfile?.website || "",
      templateId: "",
      notes: "",
    },
  });
  
  // Update form values when userProfile loads
  useState(() => {
    if (userProfile) {
      form.setValue('yourName', userProfile.name || "");
      form.setValue('yourEmail', userProfile.email || "");
      form.setValue('yourWebsite', userProfile.website || "");
    }
  });
  
  // Track outreach activity mutation
  const { mutate: trackOutreach, isPending } = useMutation({
    mutationFn: async (formData: z.infer<typeof formSchema>) => {
      const response = await apiRequest('POST', `/api/outreach/contact-form/${opportunityId}`, {
        ...formData,
        templateId: formData.templateId ? parseInt(formData.templateId) : undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Outreach tracked",
        description: "Your contact form outreach has been tracked. Continue to the form to complete the submission.",
      });
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
      form.setValue('subject', data.subject);
      form.setValue('message', data.content);
    },
  });
  
  // Handler for form submission
  function onSubmit(values: z.infer<typeof formSchema>) {
    // Track the outreach activity first
    trackOutreach(values);
    
    // Open the contact form in a new tab
    window.open(values.contactFormUrl, '_blank');
  }
  
  // Handler for template selection
  function handleTemplateChange(templateId: string) {
    form.setValue('templateId', templateId);
    
    if (templateId) {
      applyTemplate(templateId);
    }
  }
  
  // Copy to clipboard function
  function copyToClipboard(text: string, type: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopying(true);
      toast({
        title: `${type} copied`,
        description: `The ${type.toLowerCase()} has been copied to your clipboard.`,
      });
      setTimeout(() => setCopying(false), 2000);
    });
  }
  
  // Generate default message
  function getDefaultMessage(websiteName: string): string {
    return `Hello,

I recently came across your website ${websiteName} and was particularly impressed by your content about [SPECIFIC TOPIC/ARTICLE].

I've created a comprehensive resource on [YOUR RESOURCE TOPIC] that I believe would be valuable to your audience. It covers [BRIEF DESCRIPTION] and has been well-received by others in the industry.

Would you be interested in taking a look? I'd be happy to provide more details about how it could complement your existing content.

Thank you for your time and consideration.

Best regards,
[YOUR NAME]
[YOUR WEBSITE]`;
  }

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Contact Form URL selection */}
          <FormField
            control={form.control}
            name="contactFormUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Form URL</FormLabel>
                <div className="flex space-x-2">
                  <Select 
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select contact form" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {contactForms.map((formUrl, index) => (
                        <SelectItem key={index} value={formUrl}>
                          {formUrl.length > 50 ? formUrl.substring(0, 50) + '...' : formUrl}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
          
          {/* Template selection */}
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
          
          {/* Your information section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="yourName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="yourEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="yourWebsite"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Your Website</FormLabel>
                  <FormControl>
                    <Input {...field} type="url" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          {/* Subject */}
          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subject</FormLabel>
                <div className="flex space-x-2">
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(field.value, 'Subject')}
                  >
                    <ClipboardCopy className="h-4 w-4" />
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Message */}
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                <div className="flex space-x-2">
                  <FormControl>
                    <Textarea 
                      {...field}
                      rows={10}
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(field.value, 'Message')}
                  >
                    <ClipboardCopy className="h-4 w-4" />
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Notes for future reference */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (for your reference only)</FormLabel>
                <FormControl>
                  <Textarea 
                    {...field}
                    rows={3}
                    placeholder="Add any notes about this outreach for your own reference"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Submit buttons */}
          <div className="flex space-x-2">
            <Button 
              type="submit" 
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Open Contact Form
                </>
              )}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                copyToClipboard(form.getValues().message, 'Message');
                copyToClipboard(form.getValues().subject, 'Subject');
              }}
            >
              <ClipboardCopy className="mr-2 h-4 w-4" />
              Copy All Content
            </Button>
            
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                // Save as a template logic would go here
                console.log("Save as template");
              }}
              disabled={isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              Save as Template
            </Button>
          </div>
        </form>
      </Form>
      
      {/* Contact form tips */}
      <div className="mt-4 p-3 bg-muted rounded-md">
        <h4 className="text-sm font-medium mb-2">Contact Form Tips:</h4>
        <ul className="text-sm space-y-1 list-disc pl-5">
          <li>Copy the subject and message before submitting the form</li>
          <li>Be clear about the specific article or page you're referencing</li>
          <li>Make sure to include your contact information in the message</li>
          <li>Mention any metrics or benefits that make your resource valuable</li>
          <li>If they have category selection, choose "Partnership" or "Collaboration"</li>
        </ul>
      </div>
    </div>
  );
}