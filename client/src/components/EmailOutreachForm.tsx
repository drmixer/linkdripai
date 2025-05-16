import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Mail, Copy, Check, ExternalLink } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';

// Define form validation schema
const formSchema = z.object({
  to: z.string().email('Please enter a valid email address'),
  fromName: z.string().min(2, 'Name must be at least 2 characters'),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  message: z.string().min(20, 'Message must be at least 20 characters'),
});

interface EmailOutreachFormProps {
  opportunityId: number;
  emails: string[];
  domain: string;
  websiteName: string;
  onSuccess?: () => void;
}

export default function EmailOutreachForm({
  opportunityId,
  emails,
  domain,
  websiteName,
  onSuccess
}: EmailOutreachFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [copied, setCopied] = useState('');
  const [selectedEmail, setSelectedEmail] = useState(emails.length > 0 ? emails[0] : '');
  
  // Get email templates
  const { data: templates = [] } = useQuery({
    queryKey: ['/api/email-templates'],
    enabled: emails.length > 0,
  });
  
  // Form definition with default values
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      to: selectedEmail,
      fromName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
      subject: `Collaboration opportunity with ${user?.websites?.[0]?.domain || 'my website'}`,
      message: getDefaultMessage(websiteName),
    },
  });

  // Record email outreach mutation
  const recordOutreachMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const response = await apiRequest('POST', '/api/outreach/email', {
        ...values,
        opportunityId,
        domain,
        websiteName,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Outreach recorded',
        description: 'Your email outreach has been recorded',
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

  // Handle email selection
  function handleEmailChange(email: string) {
    setSelectedEmail(email);
    form.setValue('to', email);
  }

  // Handle template selection
  function handleTemplateChange(templateId: string) {
    const template = templates.find(t => t.id.toString() === templateId);
    if (template) {
      const subject = template.subject.replace(/{{website}}/g, domain);
      const message = template.content
        .replace(/{{website}}/g, websiteName)
        .replace(/{{domain}}/g, domain);
      
      form.setValue('subject', subject);
      form.setValue('message', message);
    }
  }

  // Copy text to clipboard
  function copyToClipboard(text: string, type: string) {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(''), 2000);
  }

  // Generate a default message template
  function getDefaultMessage(websiteName: string): string {
    return `Hello ${websiteName} team,

I was exploring your website and was impressed by your content on [topic]. I run a website in a similar niche, and I think there may be an opportunity for us to collaborate.

Recently, I published a comprehensive guide on [your topic] that I believe would be valuable for your audience. Would you be interested in checking it out for a potential link?

I'm also open to discussing other collaboration opportunities that would be mutually beneficial.

Looking forward to your response,
[Your Name]`;
  }

  if (emails.length === 0) {
    return (
      <div className="p-6 text-center bg-gray-50 rounded-lg border border-gray-200">
        <Mail className="h-6 w-6 text-gray-400 mx-auto mb-2" />
        <h3 className="text-lg font-medium mb-2">No Email Addresses Found</h3>
        <p className="text-gray-500 mb-4">
          No email addresses were found for this opportunity.
        </p>
        <p className="text-sm text-gray-500">
          Try reaching out through other contact methods like social media or contact forms.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Mail className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-medium">Email Outreach</h3>
      </div>
      
      {/* Email selection if multiple */}
      {emails.length > 1 && (
        <div className="mb-6">
          <FormLabel>Select recipient email:</FormLabel>
          <Select 
            value={selectedEmail}
            onValueChange={handleEmailChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an email" />
            </SelectTrigger>
            <SelectContent>
              {emails.map((email) => (
                <SelectItem key={email} value={email}>
                  {email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Template selection */}
      {templates.length > 0 && (
        <div className="mb-6">
          <FormLabel>Choose a template:</FormLabel>
          <Select 
            onValueChange={handleTemplateChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id.toString()}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Email form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To</FormLabel>
                  <FormControl>
                    <div className="flex">
                      <Input {...field} readOnly className="bg-gray-50" />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="ml-2"
                        onClick={() => copyToClipboard(field.value, 'to')}
                      >
                        {copied === 'to' ? (
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
            
            <FormField
              control={form.control}
              name="fromName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subject</FormLabel>
                <FormControl>
                  <div className="flex">
                    <Input placeholder="Email subject" {...field} />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="ml-2"
                      onClick={() => copyToClipboard(field.value, 'subject')}
                    >
                      {copied === 'subject' ? (
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
                'Record Email Outreach'
              )}
            </Button>
          </div>
        </form>
      </Form>
      
      {/* Tips */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2">Email Outreach Tips</h4>
          <ul className="text-sm text-gray-600 space-y-2 list-disc pl-4">
            <li>Personalize your email to show you've actually visited their website</li>
            <li>Keep your email concise and to the point</li>
            <li>Clearly explain the value you're offering</li>
            <li>Include a specific call-to-action</li>
            <li>Proofread before sending to avoid typos and grammatical errors</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}