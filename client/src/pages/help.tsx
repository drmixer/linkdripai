import React, { useState, useEffect } from 'react';
import Layout from '@/components/layout';
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
import { Textarea } from '@/components/ui/textarea';
import { ChevronRight, Search, Mail, MessageSquare, FileQuestion, BookOpen, Sparkles, HelpCircle, CreditCard, Gift } from 'lucide-react';
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';

// Comprehensive FAQ data with categories
const faqs = [
  {
    id: 1,
    category: "account",
    question: "How do I upgrade or downgrade my subscription plan?",
    answer: "You can change your subscription plan from the Billing section in your account settings. Navigate to Settings -> Billing, and click on 'View Subscription Plans' to see available options. Changes to your plan will take effect at the start of your next billing cycle."
  },
  {
    id: 2,
    category: "account",
    question: "How does billing work for LinkDripAI?",
    answer: "LinkDripAI subscription plans are billed monthly or annually (with a discount). You can view your current plan, payment history, and next billing date in the Billing section. Your subscription automatically renews unless you cancel it before the renewal date."
  },
  {
    id: 3,
    category: "account",
    question: "Can I cancel my subscription at any time?",
    answer: "Yes, you can cancel your subscription at any time from the Billing section. When you cancel, your account will remain active until the end of your current billing period, after which you'll be downgraded to the free plan."
  },
  {
    id: 4,
    category: "splashes",
    question: "What exactly is a Splash?",
    answer: "A Splash is a premium feature that gives you instant access to a high-quality backlink opportunity. Splash opportunities are guaranteed to have at least a Domain Authority (DA) of 40+, relevance score of 80%+, and spam score below 2%. These are premium opportunities identified by our AI system."
  },
  {
    id: 5,
    category: "splashes",
    question: "How many Splashes do I get per month?",
    answer: "The number of monthly Splashes depends on your subscription plan: Free Trial/Starter: 1 Splash/month, Grow: 3 Splashes/month, Pro: 7 Splashes/month. You can also purchase additional Splashes separately if you need more."
  },
  {
    id: 6,
    category: "opportunity",
    question: "What's the difference between regular opportunities and Splash opportunities?",
    answer: "Regular opportunities (Drips) are daily backlink prospects matched to your website, with varying quality levels. Splash opportunities are premium prospects guaranteed to have high Domain Authority (40+), high content relevance (80%+), and low spam scores (<2%). Think of Splashes as the 'cream of the crop' opportunities."
  },
  {
    id: 7,
    category: "opportunity",
    question: "How many regular opportunities (Drips) do I receive daily?",
    answer: "The number of daily Drips depends on your subscription: Free Trial/Starter: Up to 5 drips/day/site, Grow: Up to 10 drips/day/site, Pro: Up to 15 drips/day/site. These are per website, so if you have multiple sites, each one gets its own allocation of opportunities."
  },
  {
    id: 8,
    category: "email",
    question: "How do I set up email integration?",
    answer: "Email integration is part of the onboarding process, but you can update your settings anytime in Settings -> Email Settings. LinkDripAI supports three methods: SendGrid API, SMTP Server, or Gmail integration. For each method, you'll need to provide authentication details like API keys or account credentials."
  },
  {
    id: 9,
    category: "email",
    question: "Why do I need to verify my email address?",
    answer: "Email verification ensures that you have permission to send from that address and helps maintain high deliverability rates. This prevents spam and protects both you and the recipients. You'll receive a verification link to confirm each email address before it can be used for outreach."
  },
  {
    id: 10,
    category: "website",
    question: "How do I add another website to my account?",
    answer: "You can add additional websites in the Websites section. Note that the number of websites you can add depends on your subscription plan: Starter allows 1 website, Grow allows 2 websites, and Pro allows up to 5 websites. For each new site, you'll need to complete the setup process including niche selection and preferences."
  },
  {
    id: 11,
    category: "website",
    question: "Can I update my website preferences after setup?",
    answer: "Yes, you can update your website preferences at any time in the Websites section. This includes changing your target keywords, preferred backlink types, content focuses, and competitor information. These updates help our AI better understand your needs and find more relevant opportunities."
  },
  {
    id: 12,
    category: "opportunity",
    question: "How does LinkDripAI find relevant opportunities for my website?",
    answer: "LinkDripAI uses a sophisticated AI-powered matching system that analyzes your website's content, niche, and target keywords. It then crawls the web for potential backlink opportunities, evaluating them based on relevance, Domain Authority, spam score, and other SEO metrics to find the best matches for your site."
  },
  {
    id: 13,
    category: "opportunity",
    question: "What metrics are used to evaluate backlink opportunities?",
    answer: "LinkDripAI evaluates backlink opportunities using several key metrics, including Domain Authority (DA), Page Authority (PA), spam score, relevance score (calculated using AI content analysis), and outbound link count. These metrics help ensure you're getting high-quality, relevant backlink opportunities that will positively impact your SEO."
  },
  {
    id: 14,
    category: "account",
    question: "What is the difference between the subscription plans?",
    answer: "LinkDripAI offers three subscription plans: Free Trial/Starter ($9/mo), Grow ($19/mo), and Pro ($39/mo). The main differences are the number of daily opportunities (5, 10, or 15 per site), number of Splashes per month (1, 3, or 7 total), number of websites you can manage (1, 2, or 5), and access to advanced filtering and analytics features."
  }
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFaqs, setFilteredFaqs] = useState(faqs);
  const [activeCategory, setActiveCategory] = useState('all');
  
  // Filter FAQs based on search query and active category
  useEffect(() => {
    let results = faqs;
    
    if (searchQuery.trim() !== '') {
      results = results.filter(faq => 
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (activeCategory !== 'all') {
      results = results.filter(faq => faq.category === activeCategory);
    }
    
    setFilteredFaqs(results);
  }, [searchQuery, activeCategory]);
  
  const categories = [
    { id: 'all', label: 'All Topics', icon: <HelpCircle className="h-4 w-4" /> },
    { id: 'account', label: 'Account & Billing', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'splashes', label: 'Splashes', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'opportunity', label: 'Opportunities', icon: <Gift className="h-4 w-4" /> },
    { id: 'email', label: 'Email Outreach', icon: <Mail className="h-4 w-4" /> },
    { id: 'website', label: 'Website Management', icon: <BookOpen className="h-4 w-4" /> }
  ];

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Help Center</h1>
        <p className="text-muted-foreground">Find answers to common questions about LinkDripAI</p>
      </div>
      
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left sidebar for categories */}
        <div className="md:w-1/4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-0">
              {categories.map(category => (
                <Button
                  key={category.id}
                  variant={activeCategory === category.id ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveCategory(category.id)}
                >
                  <div className="flex items-center">
                    {category.icon}
                    <span className="ml-2">{category.label}</span>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>
          
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle>Need More Help?</CardTitle>
              <CardDescription>
                Can't find what you're looking for? Contact our support team.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" variant="outline">
                <Mail className="mr-2 h-4 w-4" />
                Email Support
              </Button>
              <Button className="w-full" variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" />
                Live Chat
              </Button>
            </CardContent>
          </Card>
        </div>
        
        {/* Main content area */}
        <div className="md:w-3/4">
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search for answers..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
          
          <Tabs defaultValue="faqs">
            <TabsList className="mb-4">
              <TabsTrigger value="faqs">Frequently Asked Questions</TabsTrigger>
              <TabsTrigger value="contact">Contact Support</TabsTrigger>
            </TabsList>
            
            <TabsContent value="faqs">
              {filteredFaqs.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                  {filteredFaqs.map((faq) => (
                    <AccordionItem key={faq.id} value={`item-${faq.id}`}>
                      <AccordionTrigger className="text-left">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="text-muted-foreground">
                          {faq.answer}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="text-center py-10">
                  <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium">No results found</h3>
                  <p className="mt-2 text-muted-foreground">
                    Try adjusting your search or category filters to find what you're looking for.
                  </p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="contact">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Contact Our Support Team</CardTitle>
                    <CardDescription>
                      Fill out the form below and we'll get back to you as soon as possible.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="name" className="text-sm font-medium">Name</label>
                          <Input id="name" placeholder="Your name" />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="email" className="text-sm font-medium">Email</label>
                          <Input id="email" type="email" placeholder="your.email@example.com" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="subject" className="text-sm font-medium">Subject</label>
                        <Input id="subject" placeholder="How can we help you?" />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="message" className="text-sm font-medium">Message</label>
                        <Textarea 
                          id="message" 
                          placeholder="Describe your issue in detail..." 
                          rows={5}
                        />
                      </div>
                      <Button type="submit" className="w-full">
                        Send Message
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}