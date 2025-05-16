import { useState, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, SendIcon, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

// Form validation schema
const formSchema = z.object({
  to: z.string().email('Please enter a valid email address'),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  message: z.string().min(50, 'Message must be at least 50 characters'),
  templateId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EmailOutreachFormProps {
  opportunityId: number;
  emails: string[];
  domain: string;
  websiteName: string;
}

export default function EmailOutreachForm({ 
  opportunityId, 
  emails = [], 
  domain, 
  websiteName
}: EmailOutreachFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'compose' | 'template'>('compose');
  const [sendingStatus, setSendingStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  // Set up the form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      to: emails[0] || '',
      subject: `Collaboration opportunity with ${user?.username || 'our website'}`,
      message: `Hi there,\n\nI came across ${websiteName || domain} and was impressed with your content. I believe we could collaborate on some mutually beneficial content.\n\nOur website focuses on [YOUR NICHE], and we'd love to explore content partnership opportunities with you.\n\nWould you be interested in discussing this further?\n\nBest regards,\n${user?.username || 'Your name'}`,
      templateId: '',
    },
  });

  // Fetch email templates
  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['/api/email-templates'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      setSendingStatus('sending');
      const response = await apiRequest('POST', '/api/outreach/email', {
        opportunityId,
        email: values.to,
        subject: values.subject,
        message: values.message,
      });
      return response.json();
    },
    onSuccess: () => {
      setSendingStatus('success');
      // Show success toast
      toast({
        title: 'Email sent successfully',
        description: 'Your outreach email has been sent.',
        variant: 'default',
      });
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/opportunities/${opportunityId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/outreach/history'] });
      form.reset();
    },
    onError: (error: Error) => {
      setSendingStatus('error');
      // Show error toast
      toast({
        title: 'Failed to send email',
        description: error.message || 'There was an error sending your email. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Watch for template selection and update form values
  const selectedTemplateId = form.watch('templateId');
  useEffect(() => {
    if (selectedTemplateId && templates) {
      const template = (templates as any).find(t => t.id.toString() === selectedTemplateId);
      if (template) {
        // Replace placeholders in template
        let subject = template.subject.replace('{website}', websiteName || domain);
        let message = template.content
          .replace('{website}', websiteName || domain)
          .replace('{user}', user?.username || 'Your name');
        
        form.setValue('subject', subject);
        form.setValue('message', message);
      }
    }
  }, [selectedTemplateId, templates, form, domain, websiteName, user]);

  // Handle form submission
  const onSubmit = (values: FormValues) => {
    sendEmailMutation.mutate(values);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Outreach</CardTitle>
        <CardDescription>
          Send a personalized email to the website owner
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'compose' | 'template')}>
          <TabsList className="mb-4">
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="template" disabled={isLoadingTemplates || !templates || (templates as any)?.length === 0}>
              Use Template
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="compose">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select email address" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {emails.map((email) => (
                            <SelectItem key={email} value={email}>
                              {email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose the email address you want to contact
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="Email subject line" {...field} />
                      </FormControl>
                      <FormDescription>
                        Make your subject line clear and compelling
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
                        Personalize your message for better response rates
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={sendingStatus === 'sending' || sendEmailMutation.isPending}
                >
                  {sendingStatus === 'sending' || sendEmailMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : sendingStatus === 'success' ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Sent Successfully
                    </>
                  ) : sendingStatus === 'error' ? (
                    <>
                      <AlertCircle className="mr-2 h-4 w-4" />
                      Try Again
                    </>
                  ) : (
                    <>
                      <SendIcon className="mr-2 h-4 w-4" />
                      Send Email
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>
          
          <TabsContent value="template">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select email address" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {emails.map((email) => (
                            <SelectItem key={email} value={email}>
                              {email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="templateId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Template</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a template" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {templates && (templates as any).map((template: any) => (
                            <SelectItem key={template.id} value={template.id.toString()}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose a template to quickly create your message
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="Email subject line" {...field} />
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
                        Feel free to customize the template to suit your needs
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={sendingStatus === 'sending' || sendEmailMutation.isPending}
                >
                  {sendingStatus === 'sending' || sendEmailMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : sendingStatus === 'success' ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Sent Successfully
                    </>
                  ) : sendingStatus === 'error' ? (
                    <>
                      <AlertCircle className="mr-2 h-4 w-4" />
                      Try Again
                    </>
                  ) : (
                    <>
                      <SendIcon className="mr-2 h-4 w-4" />
                      Send Email
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex-col items-start border-t p-4 bg-gray-50">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Email Outreach Tips</h4>
          <ul className="text-sm space-y-1 text-gray-600 list-disc list-inside">
            <li>Personalize your message with specific details about their website</li>
            <li>Clearly explain the value proposition of working together</li>
            <li>Keep it concise and focused on how you can help them</li>
            <li>Follow up politely if you don't receive a response</li>
          </ul>
        </div>
      </CardFooter>
    </Card>
  );
}