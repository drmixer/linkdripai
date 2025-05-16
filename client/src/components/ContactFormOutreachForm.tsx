import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, SendIcon, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';

// Form validation schema
const formSchema = z.object({
  formUrl: z.string().url('Please enter a valid URL'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  message: z.string().min(50, 'Message must be at least 50 characters'),
});

type FormValues = z.infer<typeof formSchema>;

interface ContactFormOutreachFormProps {
  opportunityId: number;
  contactForms: string[];
  domain: string;
  websiteName: string;
}

export default function ContactFormOutreachForm({ 
  opportunityId, 
  contactForms = [], 
  domain, 
  websiteName
}: ContactFormOutreachFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [sendingStatus, setSendingStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  // Set up the form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      formUrl: contactForms[0] || '',
      name: user?.username || '',
      email: user?.email || '',
      subject: `Collaboration opportunity with ${user?.username || 'our website'}`,
      message: `Hi there,\n\nI came across ${websiteName || domain} and was impressed with your content. I believe we could collaborate on some mutually beneficial content.\n\nOur website focuses on [YOUR NICHE], and we'd love to explore content partnership opportunities with you.\n\nWould you be interested in discussing this further?\n\nBest regards,\n${user?.username || 'Your name'}`,
    },
  });

  // Contact form submission mutation
  const contactFormMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      setSendingStatus('sending');
      const response = await apiRequest('POST', '/api/outreach/contact-form', {
        opportunityId,
        formUrl: values.formUrl,
        name: values.name,
        email: values.email,
        subject: values.subject,
        message: values.message,
      });
      return response.json();
    },
    onSuccess: () => {
      setSendingStatus('success');
      toast({
        title: 'Message prepared',
        description: 'Your contact form message has been prepared. Click "Open Form" to copy and submit through their contact form.',
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
    contactFormMutation.mutate(values);
  };

  // Open the contact form URL in a new tab
  const openContactForm = () => {
    const formUrl = form.getValues('formUrl');
    if (formUrl) {
      window.open(formUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Format URLs for display
  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      if (path === '/') {
        return `${urlObj.hostname} (Homepage Contact)`;
      } else if (path.includes('contact')) {
        return `${urlObj.hostname} (Contact Page)`;
      } else {
        return `${urlObj.hostname}${path.length > 20 ? path.substring(0, 20) + '...' : path}`;
      }
    } catch (e) {
      return url;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Form Outreach</CardTitle>
        <CardDescription>
          Send a message through the website's contact form
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="formUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Form</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a contact form" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {contactForms.map((form) => (
                        <SelectItem key={form} value={form}>
                          {formatUrl(form)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose which contact form to use
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" {...field} />
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
                      <Input placeholder="john@example.com" {...field} />
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
                    <Input placeholder="Subject line" {...field} />
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
                    <Textarea 
                      placeholder="Your message" 
                      className="min-h-[200px]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Personalize your message for better response rates
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={sendingStatus === 'sending' || contactFormMutation.isPending}
              >
                {sendingStatus === 'sending' || contactFormMutation.isPending ? (
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
                onClick={openContactForm}
                className="flex-1"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Form
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex-col items-start border-t p-4 bg-gray-50">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Contact Form Tips</h4>
          <ul className="text-sm space-y-1 text-gray-600 list-disc list-inside">
            <li>Before opening the form, copy your prepared message to clipboard</li>
            <li>Be aware that contact forms often have character limitations</li>
            <li>Some forms may have additional required fields not shown here</li>
            <li>Use a professional email address to improve response rates</li>
          </ul>
        </div>
      </CardFooter>
    </Card>
  );
}