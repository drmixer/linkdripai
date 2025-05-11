import React, { useState } from 'react';
import { Layout } from '@/components/layout';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronRight, Search, Mail, MessageSquare, FileQuestion, BookOpen, Sparkles } from 'lucide-react';
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter FAQs based on search query
  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout title="Help & Documentation">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Help & Support</h1>
          <p className="text-muted-foreground">
            Find answers to common questions and learn how to get the most out of LinkDripAI
          </p>
        </div>
      </div>
      
      <div className="relative mb-6">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search for answers..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <Tabs defaultValue="faqs" className="w-full mb-8">
        <TabsList className="mb-6">
          <TabsTrigger value="faqs">FAQs</TabsTrigger>
          <TabsTrigger value="tutorials">Tutorials</TabsTrigger>
          <TabsTrigger value="contact">Contact Support</TabsTrigger>
        </TabsList>
        
        {/* FAQs Tab */}
        <TabsContent value="faqs">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="col-span-1">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Categories</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="ghost" className="w-full justify-start" onClick={() => setSearchQuery('account')}>
                    <ChevronRight className="mr-2 h-4 w-4" />
                    Account & Billing
                  </Button>
                  <Button variant="ghost" className="w-full justify-start" onClick={() => setSearchQuery('splashes')}>
                    <ChevronRight className="mr-2 h-4 w-4" />
                    Premium Splashes
                  </Button>
                  <Button variant="ghost" className="w-full justify-start" onClick={() => setSearchQuery('opportunity')}>
                    <ChevronRight className="mr-2 h-4 w-4" />
                    Opportunities
                  </Button>
                  <Button variant="ghost" className="w-full justify-start" onClick={() => setSearchQuery('email')}>
                    <ChevronRight className="mr-2 h-4 w-4" />
                    Email Outreach
                  </Button>
                  <Button variant="ghost" className="w-full justify-start" onClick={() => setSearchQuery('website')}>
                    <ChevronRight className="mr-2 h-4 w-4" />
                    Website Management
                  </Button>
                </CardContent>
              </Card>
            </div>
            
            <div className="col-span-1 md:col-span-3">
              <Card>
                <CardHeader>
                  <CardTitle>Frequently Asked Questions</CardTitle>
                  <CardDescription>
                    {searchQuery ? `Showing results for "${searchQuery}"` : 'Browse common questions and answers'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {searchQuery && filteredFaqs.length === 0 ? (
                    <div className="text-center py-8">
                      <FileQuestion className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">No results found</h3>
                      <p className="text-muted-foreground">
                        Try a different search term or browse the categories
                      </p>
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => setSearchQuery('')}
                      >
                        Clear search
                      </Button>
                    </div>
                  ) : (
                    <Accordion type="single" collapsible className="w-full">
                      {(searchQuery ? filteredFaqs : faqs).map((faq, index) => (
                        <AccordionItem key={index} value={`item-${index}`}>
                          <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                          <AccordionContent>
                            <div className="prose prose-sm max-w-none">
                              <p>{faq.answer}</p>
                              {faq.additionalInfo && (
                                <div className="mt-3 p-3 bg-primary-50 rounded-md border border-primary-100">
                                  <p className="text-primary-800 text-sm">{faq.additionalInfo}</p>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        {/* Tutorials Tab */}
        <TabsContent value="tutorials">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tutorials.map((tutorial, index) => (
              <Card key={index} className="flex flex-col">
                <CardHeader>
                  <div className="w-full aspect-video bg-slate-100 rounded-md flex items-center justify-center mb-4">
                    <tutorial.icon className="h-10 w-10 text-primary opacity-70" />
                  </div>
                  <CardTitle className="text-lg">{tutorial.title}</CardTitle>
                  <CardDescription>{tutorial.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <ul className="space-y-2 text-sm">
                    {tutorial.topics.map((topic, topicIndex) => (
                      <li key={topicIndex} className="flex items-center">
                        <ChevronRight className="h-3 w-3 mr-2 text-primary" />
                        {topic}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <div className="p-4 pt-0 mt-auto">
                  <Button className="w-full">View Tutorial</Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        {/* Contact Support Tab */}
        <TabsContent value="contact">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-1 md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Our Support Team</CardTitle>
                  <CardDescription>
                    We typically respond within 1 business day
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="name" className="text-sm font-medium">Name</label>
                        <Input id="name" placeholder="Your name" />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium">Email</label>
                        <Input id="email" type="email" placeholder="Your email" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="subject" className="text-sm font-medium">Subject</label>
                      <Input id="subject" placeholder="What is your question about?" />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="message" className="text-sm font-medium">Message</label>
                      <textarea 
                        id="message" 
                        rows={5} 
                        className="w-full min-h-[120px] rounded-md border border-input bg-background p-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Please describe your issue in detail"
                      />
                    </div>
                    <Button type="submit" className="w-full sm:w-auto">
                      <Mail className="mr-2 h-4 w-4" />
                      Send Message
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
            
            <div className="col-span-1">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Live Chat
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Chat with our support team in real-time during business hours.
                  </p>
                  <Button variant="outline" className="w-full">
                    Start Chat
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BookOpen className="h-5 w-5 mr-2" />
                    Knowledge Base
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Browse our extensive documentation for detailed guides and tutorials.
                  </p>
                  <Button variant="outline" className="w-full">
                    Browse Articles
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}

// Sample FAQ data
const faqs = [
  {
    question: "What are Premium Splashes and how do they work?",
    answer: "Premium Splashes are a feature that delivers higher quality backlink opportunities to your dashboard. When you use a Premium Splash, you'll receive an opportunity with a Domain Authority of 40+, relevance score of 80%+, and spam score below 2%.",
    additionalInfo: "Premium Splashes are included in your subscription plan and can also be purchased separately. The number of Premium Splashes you receive depends on your plan level."
  },
  {
    question: "How many opportunities do I get each day?",
    answer: "The number of daily opportunities (drips) you receive depends on your subscription plan. Free Trial/Starter accounts receive 5 daily opportunities, Grow accounts receive 10, and Pro accounts receive 15. These opportunities refresh each day, and any unused opportunities do not carry over to the next day."
  },
  {
    question: "Why do my opportunities reset each day?",
    answer: "Your daily opportunities (drips) reset each day to provide you with fresh, relevant backlink prospects. This ensures you always have new opportunities to explore and prevents your dashboard from becoming cluttered with outdated prospects."
  },
  {
    question: "How does LinkDripAI find relevant opportunities for my website?",
    answer: "LinkDripAI uses a sophisticated AI-powered matching system that analyzes your website's content, niche, and target keywords. It then crawls the web for potential backlink opportunities, evaluating them based on relevance, Domain Authority, spam score, and other SEO metrics to find the best matches for your site."
  },
  {
    question: "Can I manage multiple websites with LinkDripAI?",
    answer: "Yes, you can manage multiple websites with LinkDripAI. The number of websites you can add depends on your subscription plan. Free Trial/Starter accounts can manage 1 website, Grow accounts can manage 2 websites, and Pro accounts can manage 5 websites."
  },
  {
    question: "What metrics are used to evaluate backlink opportunities?",
    answer: "LinkDripAI evaluates backlink opportunities using several key metrics, including Domain Authority (DA), Page Authority (PA), spam score, relevance score (calculated using AI content analysis), and outbound link count. These metrics help ensure you're getting high-quality, relevant backlink opportunities that will positively impact your SEO."
  },
  {
    question: "How do I verify ownership of my website?",
    answer: "To verify ownership of your website, you'll need to upload a small HTML verification file to your website's root directory. This file contains a unique code that proves you have access to the website. Detailed instructions are provided during the website addition process."
  },
  {
    question: "What is the difference between the subscription plans?",
    answer: "LinkDripAI offers three subscription plans: Free Trial/Starter ($9/mo), Grow ($19/mo), and Pro ($39/mo). The main differences are the number of daily opportunities (5, 10, or 15), number of Premium Splashes per month (1, 3, or 7), number of websites you can manage (1, 2, or 5), and access to advanced filtering and analytics features.",
    additionalInfo: "Pro plan users also get priority support and early access to new features."
  },
  {
    question: "How can I purchase additional Premium Splashes?",
    answer: "You can purchase additional Premium Splashes from the Add-ons tab in the Billing section. Premium Splashes can be purchased individually for $7 each, or in bundles of 3 for $18 or 7 for $35 for better value.",
    additionalInfo: "Premium Splashes never expire, so you can use them whenever you need them."
  },
  {
    question: "Can I cancel my subscription at any time?",
    answer: "Yes, you can cancel your subscription at any time from the Billing section. If you cancel, your subscription will remain active until the end of your current billing period, after which your account will be downgraded to a limited free plan with reduced features."
  },
  {
    question: "What do the relevance percentages mean?",
    answer: "Relevance percentages indicate how well a backlink opportunity matches your website's content and niche. Our AI system analyzes the content of both your website and the potential backlink opportunity to determine this score. Higher percentages (80%+) indicate a strong content match, which means the backlink is likely to be more valuable for your SEO."
  },
  {
    question: "How accurate are the Domain Authority and spam scores?",
    answer: "Domain Authority (DA) and spam scores are provided by Moz, a leading SEO analytics provider. These metrics are industry-standard and generally considered reliable indicators of a website's authority and quality. However, they should be used as guidance rather than absolute measures, as part of a comprehensive backlink evaluation strategy."
  }
];

// Sample Tutorial data
const tutorials = [
  {
    title: "Getting Started with LinkDripAI",
    description: "Learn the basics of using LinkDripAI for backlink prospecting",
    icon: BookOpen,
    topics: [
      "Setting up your account",
      "Adding your first website",
      "Understanding your dashboard",
      "Finding your first opportunities",
      "Using Premium Splashes effectively"
    ]
  },
  {
    title: "Maximizing Opportunity Quality",
    description: "Advanced techniques for finding the best backlink prospects",
    icon: Sparkles,
    topics: [
      "Using filters effectively",
      "Understanding quality metrics",
      "Prioritizing high-value opportunities",
      "When to use Premium Splashes",
      "Evaluating opportunity relevance"
    ]
  },
  {
    title: "Effective Email Outreach",
    description: "Write compelling emails that get responses",
    icon: Mail,
    topics: [
      "Crafting personalized subject lines",
      "Writing effective email body content",
      "Following up strategically",
      "Tracking email performance",
      "Negotiating backlink placements"
    ]
  },
  {
    title: "Multi-Website Management",
    description: "Strategies for managing multiple websites efficiently",
    icon: BookOpen,
    topics: [
      "Setting up additional websites",
      "Tailoring preferences for each site",
      "Balancing resources across websites",
      "Tracking multi-site performance",
      "Scaling your link building operation"
    ]
  },
  {
    title: "Understanding Analytics",
    description: "Get the most from your LinkDripAI analytics",
    icon: BookOpen,
    topics: [
      "Interpreting key metrics",
      "Setting up custom reports",
      "Tracking conversion rates",
      "Measuring ROI on your efforts",
      "Identifying performance patterns"
    ]
  },
  {
    title: "Advanced Filtering Techniques",
    description: "Master the art of filtering for the perfect opportunities",
    icon: BookOpen,
    topics: [
      "Creating custom filter combinations",
      "Saving and reusing filters",
      "Filtering by content relevance",
      "Using domain metrics effectively",
      "Identifying niche-specific opportunities"
    ]
  }
];