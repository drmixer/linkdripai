import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, ExternalLink, Copy, Check, Clipboard } from 'lucide-react';
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
  formUrl: z.string().url('Please enter a valid URL'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  message: z.string().min(20, 'Message must be at least 20 characters'),
});

interface ContactFormOutreachFormProps {
  opportunityId: number;
  contactForms: string[];
  domain: string;
  websiteName: string;
  onSuccess?: () => void;
}

export default function ContactFormOutreachForm({
  opportunityId,
  contactForms,
  domain,
  websiteName,
  onSuccess
}: ContactFormOutreachFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [copied, setCopied] = useState('');
  const [activeFormUrl, setActiveFormUrl] = useState(contactForms[0] || '');
  
  // Form definition with default values
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      formUrl: activeFormUrl,
      name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
      email: user?.email || '',
      subject: `Collaboration opportunity with ${user?.websites?.[0]?.url?.split('//')[1]?.split('/')[0] || 'my website'}`,
      message: getDefaultMessage(websiteName),
    },
  });

  // Record contact form outreach mutation
  const recordOutreachMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const response = await apiRequest('POST', '/api/outreach/contact-form', {
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
        description: 'Your contact form outreach has been recorded',
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

  // Handle form URL selection
  function handleFormUrlChange(url: string) {
    setActiveFormUrl(url);
    form.setValue('formUrl', url);
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

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-medium">Contact Form Outreach</h3>
      </div>
      
      {/* Form URL selection if multiple */}
      {contactForms.length > 1 && (
        <div className="mb-6">
          <FormLabel>Select contact form:</FormLabel>
          <Select 
            value={activeFormUrl}
            onValueChange={handleFormUrlChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a contact form" />
            </SelectTrigger>
            <SelectContent>
              {contactForms.map((url) => (
                <SelectItem key={url} value={url}>
                  {url.length > 40 ? url.substring(0, 40) + '...' : url}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Selected form */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <div className="font-medium">Selected Form:</div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center text-xs"
              onClick={() => copyToClipboard(activeFormUrl, 'form')}
            >
              {copied === 'form' ? (
                <>Copied <Check className="h-3 w-3 ml-1" /></>
              ) : (
                <>Copy URL <Copy className="h-3 w-3 ml-1" /></>
              )}
            </Button>
            <a
              href={activeFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded-md"
            >
              Open Form <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </div>
        </div>
        <div className="p-3 bg-gray-50 rounded-md text-sm break-all">
          {activeFormUrl}
        </div>
      </div>

      {/* Message form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Email</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your email" {...field} />
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
                    <Input placeholder="Enter subject" {...field} />
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
                'Record Contact Form Outreach'
              )}
            </Button>
          </div>
        </form>
      </Form>
      
      {/* Tips */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2">Contact Form Tips</h4>
          <ul className="text-sm text-gray-600 space-y-2 list-disc pl-4">
            <li>Make sure to check the actual form fields on the website</li>
            <li>Some forms may have additional required fields</li>
            <li>Copy and paste the content into the actual form</li>
            <li>Consider adding your website URL in the message</li>
            <li>Contact forms often have spam filters - keep your message professional</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}