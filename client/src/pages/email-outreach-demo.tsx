import React from 'react';
import { OpportunityEmailOutreach } from '@/components/OpportunityEmailOutreach';
import { EmailStatusExamples } from '@/components/EmailStatusExamples';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Helmet } from 'react-helmet';

// Mock data for the demo
const mockOpportunity = {
  id: 123,
  url: "https://example.com/blog",
  domain: "example.com",
  title: "High Quality Tech Blog",
  domainAuthority: 45,
  pageAuthority: 38,
  spamScore: 1,
  relevanceScore: 87,
  type: "Guest Post",
  contactInfo: {
    emails: ["editor@example.com", "info@example.com"],
    socialProfiles: [
      {
        platform: "twitter",
        url: "https://twitter.com/example",
        username: "@example"
      },
      {
        platform: "linkedin",
        url: "https://linkedin.com/company/example",
        username: "example"
      }
    ],
    contactForms: [
      "https://example.com/contact",
      "https://example.com/submit-guest-post"
    ]
  }
};

const mockEmailAccounts = [
  {
    id: 1,
    email: "your.name@yoursite.com",
    name: "Your Name",
    website: "yoursite.com"
  },
  {
    id: 2,
    email: "marketing@client-site.com",
    name: "Client Marketing",
    website: "client-site.com"
  }
];

const mockEmailTemplates = [
  {
    id: "guest-post",
    name: "Guest Post Outreach",
    subject: "Guest Post Opportunity for {{domain}}",
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
{{yourCompany}}`
  },
  {
    id: "backlink-request",
    name: "Backlink Request",
    subject: "Resource suggestion for {{domain}}",
    body: `Hello {{firstName}},

I was reading your excellent article at {{website}} and noticed you mentioned [topic they mentioned].

I recently published a comprehensive guide on [your related topic] that would perfectly complement the information in your article. It includes [briefly describe what makes your content valuable - statistics, case studies, examples, etc.].

You can find it here: [Your URL]

If you find it helpful, perhaps you could consider adding it as a resource in your article? I believe it would provide additional value to your readers.

Either way, keep up the great work with your content!

Best regards,
{{yourName}}
{{yourCompany}}`
  }
];

/**
 * A demo page to showcase the email outreach components
 */
export default function EmailOutreachDemo() {
  const handleEmailSent = (opportunityId: number, emailData: any) => {
    console.log('Email sent for opportunity:', opportunityId, emailData);
  };
  
  return (
    <div className="container py-8">
      <Helmet>
        <title>Email Outreach Tools - LinkDripAI</title>
        <meta name="description" content="Email outreach tools for backlink opportunities with comprehensive status tracking and template management." />
      </Helmet>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Email Outreach Tools</h1>
        <p className="text-muted-foreground">
          Send personalized outreach emails to potential backlink opportunities and track their status
        </p>
      </div>
      
      <Tabs defaultValue="outreach" className="w-full">
        <TabsList className="w-full mb-6">
          <TabsTrigger value="outreach">Outreach Interface</TabsTrigger>
          <TabsTrigger value="status-indicators">Status Indicators</TabsTrigger>
        </TabsList>
        
        <TabsContent value="outreach">
          <div className="grid grid-cols-1 gap-8">
            <OpportunityEmailOutreach
              opportunity={mockOpportunity}
              emailAccounts={mockEmailAccounts}
              emailTemplates={mockEmailTemplates}
              onEmailSent={handleEmailSent}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="status-indicators">
          <EmailStatusExamples />
        </TabsContent>
      </Tabs>
    </div>
  );
}