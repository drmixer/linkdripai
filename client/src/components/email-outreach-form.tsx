import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

interface EmailOutreachFormProps {
  opportunity: any;
  websiteId: number;
  onSuccess?: () => void;
}

export function EmailOutreachForm({ 
  opportunity, 
  websiteId,
  onSuccess
}: EmailOutreachFormProps) {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  // Generate email subject
  const getDefaultSubject = () => {
    const siteName = opportunity.title || 
      (opportunity.url ? new URL(opportunity.url).hostname.replace('www.', '') : 'your website');
    return `Backlink partnership opportunity for ${siteName}`;
  };

  // Generate email body
  const getDefaultBody = () => {
    const siteName = opportunity.title || 
      (opportunity.url ? new URL(opportunity.url).hostname.replace('www.', '') : 'your website');
    
    return `Hi there,

I recently discovered ${siteName} and was impressed with your content, especially in the ${opportunity.categories?.[0] || 'digital marketing'} space.

I'm reaching out because I believe there's a great opportunity for us to collaborate. I run a website in a complementary niche, and I think our audiences would benefit from cross-promotion.

Would you be interested in exploring a content partnership where we could exchange valuable backlinks? I have some specific ideas for how we could create a win-win situation.

Let me know if you'd like to discuss further!

Best regards,
[Your Name]`;
  };

  // Form schema
  const formSchema = z.object({
    subject: z.string().min(1, "Subject is required"),
    body: z.string().min(10, "Message is too short"),
    toEmail: z.string().email("Valid email is required"),
  });

  // Determine default to email
  const getDefaultToEmail = () => {
    if (opportunity.contactInfo?.emails && opportunity.contactInfo.emails.length > 0) {
      return opportunity.contactInfo.emails[0];
    }
    return '';
  };

  // Set up form with default values
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subject: getDefaultSubject(),
      body: getDefaultBody(),
      toEmail: getDefaultToEmail(),
    },
  });

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSending(true);
    
    try {
      const response = await fetch('/api/email/send-outreach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          opportunityId: opportunity.id,
          websiteId: websiteId,
          subject: values.subject,
          body: values.body,
          toEmail: values.toEmail,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Email sent successfully",
          description: "Your outreach email has been delivered.",
        });
        if (onSuccess) onSuccess();
      } else {
        throw new Error(data.error || 'Failed to send email');
      }
    } catch (error: any) {
      toast({
        title: "Failed to send email",
        description: error?.message || "There was an error sending your email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="toEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>To Email</FormLabel>
              <FormControl>
                <Input placeholder="recipient@example.com" {...field} />
              </FormControl>
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
                <Input placeholder="Email subject" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="body"
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
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button 
          type="submit" 
          disabled={isSending}
          className="w-full"
        >
          {isSending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            'Send Email'
          )}
        </Button>
      </form>
    </Form>
  );
}