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
import { Loader2, Mail, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface EmailOutreachFormProps {
  opportunityId: number;
  emails: string[];
  domain: string;
  websiteName: string;
  onSuccess?: () => void;
}

// Form validation schema
const formSchema = z.object({
  emailTo: z.string().email("Please select a valid email address"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(20, "Message must be at least 20 characters"),
  templateId: z.string().optional(),
  scheduledFor: z.string().optional(),
});

export default function EmailOutreachForm({ 
  opportunityId, 
  emails, 
  domain, 
  websiteName,
  onSuccess
}: EmailOutreachFormProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const queryClient = useQueryClient();
  
  // Fetch available email templates
  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['/api/email-templates'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/email-templates`);
      const data = await response.json();
      return data;
    }
  });
  
  // Form setup
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      emailTo: emails[0] || "",
      subject: `Opportunity for collaboration with ${websiteName}`,
      message: getDefaultMessage(websiteName),
      templateId: "",
      scheduledFor: "",
    },
  });
  
  // Send email mutation
  const { mutate: sendEmail, isPending } = useMutation({
    mutationFn: async (formData: z.infer<typeof formSchema>) => {
      const response = await apiRequest('POST', `/api/outreach/email/${opportunityId}`, {
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
      const response = await apiRequest('GET', `/api/email-templates/${templateId}`);
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
    sendEmail(values);
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

I recently came across your website ${websiteName} and I'm impressed with your content. I noticed an opportunity for collaboration that could benefit both our audiences.

I've created a comprehensive resource on [Your Topic] that would complement your article about [Their Relevant Article]. Would you be interested in checking it out? I believe it would add value to your readers.

Looking forward to your response!

Best regards,
[Your Name]
[Your Website]`;
  }

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Template selection */}
          {!isLoadingTemplates && templates && templates.length > 0 && (
            <FormField
              control={form.control}
              name="templateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Template</FormLabel>
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
          
          {/* Email recipient */}
          <FormField
            control={form.control}
            name="emailTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email To</FormLabel>
                <Select 
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipient email" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {emails.map((email, index) => (
                      <SelectItem key={index} value={email}>
                        {email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Email subject */}
          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subject</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Email subject"
                    {...field}
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Email message */}
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Email message"
                    rows={12}
                    {...field}
                    disabled={isPending}
                  />
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
          
          {/* Submit and preview buttons */}
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
                  <Mail className="mr-2 h-4 w-4" />
                  Send Email
                </>
              )}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              disabled={isPending || isApplyingTemplate}
            >
              {isPreviewMode ? "Edit" : "Preview"}
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
      
      {/* Preview mode */}
      {isPreviewMode && (
        <div className="mt-6 border rounded-md p-4 space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">From</h3>
            <p>Your Name &lt;your-email@yourdomain.com&gt;</p>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">To</h3>
            <p>{form.getValues().emailTo}</p>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Subject</h3>
            <p className="font-medium">{form.getValues().subject}</p>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Message</h3>
            <div className="whitespace-pre-wrap p-4 bg-gray-50 rounded text-sm">
              {form.getValues().message}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}