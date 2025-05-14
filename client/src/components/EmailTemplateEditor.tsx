import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Save, Wand2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Available variables for personalization
const AVAILABLE_VARIABLES = [
  { key: 'website', description: 'The target website URL' },
  { key: 'domain', description: 'The target domain name' },
  { key: 'firstName', description: 'Recipient first name (if available)' },
  { key: 'lastName', description: 'Recipient last name (if available)' },
  { key: 'fullName', description: 'Recipient full name (if available)' },
  { key: 'companyName', description: 'Company or organization name' },
  { key: 'domainAuthority', description: 'Domain Authority score' },
  { key: 'pageAuthority', description: 'Page Authority score' },
  { key: 'relevanceScore', description: 'LinkDripAI relevance score' },
  { key: 'opportunityType', description: 'The type of opportunity (guest post, blog, etc.)' },
  { key: 'yourName', description: 'Your name' },
  { key: 'yourWebsite', description: 'Your website' },
  { key: 'yourCompany', description: 'Your company name' },
];

// Example templates to choose from
const EMAIL_TEMPLATES = [
  {
    id: 'guest-post',
    name: 'Guest Post Outreach',
    subject: 'Guest Post Opportunity for {{domain}}',
    body: `Hi {{firstName}},

I was browsing {{website}} and love your content about [their content topic]. I particularly enjoyed your article about [mention specific article].

I'm reaching out because I'd like to contribute a guest post to your site. I've been working in this industry for several years and have some insights that I believe would resonate with your audience.

Here are a few topic ideas that might be a good fit:

1. [Topic idea 1]
2. [Topic idea 2]
3. [Topic idea 3]

I'd be happy to customize these further based on your preferences. All of my content is original, well-researched, and provides actionable insights for your readers.

Would you be interested in a guest contribution? I'd love to hear your thoughts.

Best regards,
{{yourName}}
{{yourCompany}}`,
  },
  {
    id: 'backlink-request',
    name: 'Backlink Request',
    subject: 'Resource suggestion for {{domain}}',
    body: `Hello {{firstName}},

I was reading your excellent article at {{website}} and noticed you mentioned [topic they mentioned].

I recently published a comprehensive guide on [your related topic] that would perfectly complement the information in your article. It includes [briefly describe what makes your content valuable - statistics, case studies, examples, etc.].

You can find it here: [Your URL]

If you find it helpful, perhaps you could consider adding it as a resource in your article? I believe it would provide additional value to your readers.

Either way, keep up the great work with your content!

Best regards,
{{yourName}}
{{yourCompany}}`,
  },
  {
    id: 'broken-link',
    name: 'Broken Link Replacement',
    subject: 'Quick fix for {{domain}} - Broken link found',
    body: `Hi there,

I was reading your excellent content on {{website}} and noticed that there's a broken link pointing to [describe the broken link].

I thought you might want to know so you can update it. As someone who also creates content about [relevant topic], I understand how hard it is to keep all links working properly.

If you're looking for a replacement, I actually have a resource on [topic of broken link] that could be a good substitute: [your URL]

Either way, I hope this helps maintain the quality of your excellent site.

Thanks,
{{yourName}}
{{yourCompany}}`,
  },
];

interface EmailTemplateEditorProps {
  initialTemplate?: {
    id?: string;
    name: string;
    subject: string;
    body: string;
  };
  onSave: (template: {
    id?: string;
    name: string;
    subject: string;
    body: string;
  }) => void;
}

/**
 * A component for creating and editing email templates with variable placeholders
 */
export function EmailTemplateEditor({ initialTemplate, onSave }: EmailTemplateEditorProps) {
  const [template, setTemplate] = useState({
    id: initialTemplate?.id || '',
    name: initialTemplate?.name || '',
    subject: initialTemplate?.subject || '',
    body: initialTemplate?.body || '',
  });
  
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, string>>({
    website: 'https://example.com',
    domain: 'example.com',
    firstName: 'John',
    lastName: 'Smith',
    fullName: 'John Smith',
    companyName: 'Example Company',
    domainAuthority: '45',
    pageAuthority: '38',
    relevanceScore: '87%',
    opportunityType: 'Guest Post',
    yourName: 'Your Name',
    yourWebsite: 'yoursite.com',
    yourCompany: 'Your Company',
  });
  
  const insertVariable = (variable: string) => {
    const tag = `{{${variable}}}`;
    const textarea = document.getElementById('email-body') as HTMLTextAreaElement;
    
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const newText = text.substring(0, start) + tag + text.substring(end);
      
      setTemplate({ ...template, body: newText });
      
      // Set cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    } else {
      setTemplate({ ...template, body: template.body + tag });
    }
  };
  
  const insertVariableInSubject = (variable: string) => {
    const tag = `{{${variable}}}`;
    setTemplate({ ...template, subject: template.subject + tag });
  };
  
  const handleTemplateSelect = (templateId: string) => {
    const selectedTemplate = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (selectedTemplate) {
      setTemplate({
        id: selectedTemplate.id,
        name: selectedTemplate.name,
        subject: selectedTemplate.subject,
        body: selectedTemplate.body,
      });
    }
  };
  
  const replaceVariables = (text: string, data: Record<string, string>) => {
    return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return data[variable] || match;
    });
  };
  
  const previewSubject = replaceVariables(template.subject, previewData);
  const previewBody = replaceVariables(template.body, previewData);
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Email Template Editor</CardTitle>
        <CardDescription>
          Create personalized email templates with dynamic variables
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="editor" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="editor">Edit Template</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          
          <TabsContent value="editor" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input 
                id="template-name"
                value={template.name}
                onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                placeholder="E.g., Guest Post Outreach"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="email-subject">Email Subject</Label>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <PlusCircle className="h-4 w-4 mr-1" />
                      Add Variable
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Insert Variable</DialogTitle>
                      <DialogDescription>
                        Select a variable to insert into your email subject.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-2 py-4">
                      {AVAILABLE_VARIABLES.map((variable) => (
                        <Button
                          key={variable.key}
                          variant="outline"
                          onClick={() => {
                            insertVariableInSubject(variable.key);
                          }}
                          className="justify-start"
                        >
                          <span>{'{{' + variable.key + '}}'}</span>
                        </Button>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <Input
                id="email-subject"
                value={template.subject}
                onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
                placeholder="E.g., Guest Post Opportunity for {{domain}}"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="email-body">Email Body</Label>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <PlusCircle className="h-4 w-4 mr-1" />
                      Add Variable
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Insert Variable</DialogTitle>
                      <DialogDescription>
                        Select a variable to insert into your email body.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-2 py-4">
                      {AVAILABLE_VARIABLES.map((variable) => (
                        <Button
                          key={variable.key}
                          variant="outline"
                          onClick={() => {
                            insertVariable(variable.key);
                          }}
                          className="justify-start"
                        >
                          <span>{'{{' + variable.key + '}}'}</span>
                        </Button>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <Textarea
                id="email-body"
                value={template.body}
                onChange={(e) => setTemplate({ ...template, body: e.target.value })}
                placeholder="Write your email template here..."
                className="min-h-[300px] font-mono"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Starter Templates</Label>
              <div className="flex flex-wrap gap-2">
                {EMAIL_TEMPLATES.map((emailTemplate) => (
                  <Button
                    key={emailTemplate.id}
                    variant="outline"
                    onClick={() => handleTemplateSelect(emailTemplate.id)}
                    className="flex items-center"
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    {emailTemplate.name}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="preview" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Preview Data</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {Object.entries(previewData).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Label htmlFor={`preview-${key}`} className="w-1/3">
                        {key}:
                      </Label>
                      <Input
                        id={`preview-${key}`}
                        value={value}
                        onChange={(e) => 
                          setPreviewData({ ...previewData, [key]: e.target.value })
                        }
                        className="w-2/3"
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="border rounded-md p-4 space-y-4">
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Subject</Label>
                  <div className="text-base font-medium">{previewSubject}</div>
                </div>
                
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Body</Label>
                  <div className="whitespace-pre-wrap border rounded-md p-4 bg-slate-50">
                    {previewBody}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <div className="flex flex-wrap gap-1">
          {template.body.match(/\{\{(\w+)\}\}/g)?.map((match, i) => {
            const variable = match.replace(/\{\{|\}\}/g, '');
            return (
              <Badge key={i} variant="secondary">
                {variable}
              </Badge>
            );
          })}
        </div>
        
        <Button 
          onClick={() => onSave(template)}
          disabled={!template.name || !template.subject || !template.body}
        >
          <Save className="h-4 w-4 mr-2" />
          Save Template
        </Button>
      </CardFooter>
    </Card>
  );
}