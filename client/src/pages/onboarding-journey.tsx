import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link } from 'wouter';
import { Logo } from '@/components/logo';

// Import our new onboarding components
import OnboardingJourneyMap from '@/components/onboarding/journey-map';
import OnboardingGoalSteps from '@/components/onboarding/goal-steps';
import AiProcessAnimation from '@/components/onboarding/ai-process-animation';

// Form schemas
const subscriptionSchema = z.object({
  plan: z.enum(["Free Trial", "Starter", "Grow", "Pro"]),
});

const websiteSchema = z.object({
  url: z.string().url({ message: "Please enter a valid URL" }),
  niche: z.string().min(1, { message: "Please select a niche" }),
  description: z.string().optional(),
});

const preferencesSchema = z.object({
  linkTypes: z.array(z.string()).min(1, { message: "Please select at least one link type" }),
  avoidNiches: z.string().optional(),
});

const emailSetupSchema = z.object({
  provider: z.enum(["sendgrid", "smtp", "gmail"]),
  fromEmail: z.string().email({ message: "Please enter a valid email" }),
  fromName: z.string().min(1, { message: "Please enter a name" }),
  apiKey: z.string().min(1, { message: "Please enter your API key" }).optional(),
  termsAccepted: z.boolean().refine(val => val === true, {
    message: "You must accept the terms",
  }),
});

// Form value types
type SubscriptionFormValues = z.infer<typeof subscriptionSchema>;
type WebsiteFormValues = z.infer<typeof websiteSchema>;
type PreferencesFormValues = z.infer<typeof preferencesSchema>;
type EmailSetupFormValues = z.infer<typeof emailSetupSchema>;

// Niche options
const NICHE_OPTIONS = [
  "Technology",
  "Health & Wellness",
  "Finance",
  "Travel",
  "Food & Cooking",
  "Fitness",
  "Education",
  "Marketing",
  "Home & Garden",
  "Fashion",
  "Beauty",
  "Business",
  "Entertainment",
  "Gaming",
  "Sports",
  "Other"
];

// Link types
const LINK_TYPES = [
  { id: "guest-post", label: "Guest Posts" },
  { id: "resource-page", label: "Resource Pages" },
  { id: "directory", label: "Directories" },
  { id: "blog-comment", label: "Blog Comments" },
  { id: "forum", label: "Forums" }
];

export default function OnboardingJourney() {
  const [step, setStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(4);
  const [isLoading, setIsLoading] = useState(false);
  // Get the selected plan from localStorage if available
  const [selectedPlan, setSelectedPlan] = useState<"Free Trial" | "Starter" | "Grow" | "Pro">(() => {
    const savedPlan = typeof window !== 'undefined' ? localStorage.getItem('selectedPlan') : null;
    return (savedPlan as "Free Trial" | "Starter" | "Grow" | "Pro") || "Free Trial";
  });
  const [websites, setWebsites] = useState<WebsiteFormValues[]>([]);
  const [currentWebsiteIndex, setCurrentWebsiteIndex] = useState(0);
  const [preferences, setPreferences] = useState<(PreferencesFormValues & { websiteId: number })[]>([]);
  const { user } = useAuth();
  const [_, navigate] = useLocation();
  const { toast } = useToast();

  // Initialize subscription form with the selected plan from localStorage
  const subscriptionForm = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      plan: selectedPlan,
    },
  });
  
  // Effect to update form when selectedPlan changes
  useEffect(() => {
    subscriptionForm.setValue('plan', selectedPlan);
  }, [selectedPlan, subscriptionForm]);

  // Initialize website form
  const websiteForm = useForm<WebsiteFormValues>({
    resolver: zodResolver(websiteSchema),
    defaultValues: {
      url: "",
      niche: "",
      description: "",
    },
  });

  // Initialize preferences form
  const preferencesForm = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      linkTypes: [],
      avoidNiches: "",
    },
  });

  // Initialize email setup form
  const emailSetupForm = useForm<EmailSetupFormValues>({
    resolver: zodResolver(emailSetupSchema),
    defaultValues: {
      provider: "sendgrid",
      fromEmail: user?.email || "",
      fromName: user?.firstName ? `${user.firstName} ${user.lastName || ''}` : "",
      apiKey: "",
      termsAccepted: false,
    },
  });

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    } else if (user.onboardingCompleted) {
      // If onboarding is already complete, redirect to dashboard
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // Handle subscription form submission
  const onSubscriptionSubmit = async (values: SubscriptionFormValues) => {
    setIsLoading(true);
    try {
      // Update the selected plan
      setSelectedPlan(values.plan);
      
      // Store in localStorage
      localStorage.setItem('selectedPlan', values.plan);
      
      // Send to server
      const response = await fetch("/api/onboarding/subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: values.plan }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update subscription");
      }
      
      // Move to next step
      setStep(2);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to update subscription",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle website form submission
  const onWebsiteSubmit = (values: WebsiteFormValues) => {
    // Add the website to the list
    const updatedWebsites = [...websites];
    
    if (currentWebsiteIndex < updatedWebsites.length) {
      // Update existing website
      updatedWebsites[currentWebsiteIndex] = values;
    } else {
      // Add new website
      updatedWebsites.push(values);
    }
    
    setWebsites(updatedWebsites);
    
    // Reset form for next website
    websiteForm.reset({
      url: "",
      niche: "",
      description: "",
    });
    
    // Move to preferences step
    setStep(3);
  };

  // Handle preferences form submission
  const onPreferencesSubmit = (values: PreferencesFormValues) => {
    // Add the preferences to the list
    const updatedPreferences = [...preferences];
    const websiteId = currentWebsiteIndex + 1; // Simple ID for demo
    
    const existingIndex = updatedPreferences.findIndex(p => p.websiteId === websiteId);
    
    if (existingIndex >= 0) {
      // Update existing preferences
      updatedPreferences[existingIndex] = {
        ...values,
        websiteId,
      };
    } else {
      // Add new preferences
      updatedPreferences.push({
        ...values,
        websiteId,
      });
    }
    
    setPreferences(updatedPreferences);
    
    // Move to email setup step
    setStep(4);
  };

  // Handle email setup form submission
  const onEmailSetupSubmit = async (values: EmailSetupFormValues) => {
    setIsLoading(true);
    try {
      // Save websites and preferences first
      const websitesResponse = await fetch("/api/onboarding/websites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ websites }),
      });
      
      if (!websitesResponse.ok) {
        throw new Error("Failed to save websites");
      }
      
      // Save email settings
      const emailResponse = await fetch("/api/email/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      
      if (!emailResponse.ok) {
        throw new Error("Failed to save email settings");
      }
      
      // Send verification email if needed
      const { fromEmail } = values;
      if (fromEmail && fromEmail !== user?.email) {
        try {
          const verifyResponse = await fetch("/api/email/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: fromEmail }),
          });
          
          if (verifyResponse.ok) {
            toast({
              title: "Verification email sent",
              description: `Please check ${fromEmail} to verify your email address`,
            });
          }
        } catch (error) {
          console.error("Failed to send verification email:", error);
          // Don't throw error here, we want to continue onboarding
        }
      }
      
      // Mark onboarding as complete
      const completeResponse = await fetch("/api/onboarding/complete", {
        method: "POST",
      });
      
      if (!completeResponse.ok) {
        throw new Error("Failed to mark onboarding as complete");
      }
      
      // Refresh user data
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      toast({
        title: "Setup complete!",
        description: "You're all set to start using LinkDripAI",
      });
      
      // Clear localStorage
      localStorage.removeItem('selectedPlan');
      
      // Set flags for redirection
      localStorage.setItem('onboardingJustCompleted', 'true');
      localStorage.setItem('redirectAfterReload', '/dashboard');
      
      // Navigate to dashboard
      window.location.href = '/dashboard';
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to complete onboarding process",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add another website
  const addAnotherWebsite = () => {
    setCurrentWebsiteIndex(websites.length);
    setStep(2);
    
    // Reset website form
    websiteForm.reset({
      url: "",
      niche: "",
      description: "",
    });
  };

  // Get website limit based on plan
  const getWebsiteLimit = () => {
    const plan = localStorage.getItem('selectedPlan') || selectedPlan;
    if (plan === "Starter") return 1;
    if (plan === "Grow") return 2;
    if (plan === "Pro") return 5;
    return 1; // Default for Free Trial
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="container mx-auto flex items-center">
          <Link href="/">
            <Logo size="sm" />
          </Link>
        </div>
      </header>
      
      {/* Onboarding Journey Map */}
      <OnboardingJourneyMap 
        currentStep={step} 
        totalSteps={totalSteps}
      />
      
      {/* Progress Bar (for mobile) */}
      <div className="container mx-auto px-4 py-2 md:hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium">
              {step}
            </div>
            <span className="text-sm font-medium text-gray-700">Step {step} of {totalSteps}</span>
          </div>
          <span className="text-sm font-medium text-primary">{Math.round((step / totalSteps) * 100)}% Complete</span>
        </div>
        <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-primary-light transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          ></div>
        </div>
      </div>
      
      {/* Display AI Process Animation on first step */}
      {step === 1 && <AiProcessAnimation />}
      
      {/* Onboarding Content */}
      <div className="container mx-auto px-4 py-6 flex-1 flex items-center justify-center">
        <div className="w-full max-w-3xl">
          {/* Step 1: Choose Subscription Plan */}
          {step === 1 && (
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-2xl">Choose Your Plan</CardTitle>
                <CardDescription>
                  Select the plan that best fits your needs. You can upgrade or downgrade at any time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...subscriptionForm}>
                  <form onSubmit={subscriptionForm.handleSubmit(onSubscriptionSubmit)} className="space-y-6">
                    <FormField
                      control={subscriptionForm.control}
                      name="plan"
                      render={({ field }) => (
                        <FormItem>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Free Trial / Starter Plan */}
                            <div
                              className={`border-2 rounded-lg p-4 cursor-pointer ${
                                field.value === "Starter" ? "border-primary bg-primary/5" : "border-gray-200"
                              }`}
                              onClick={() => field.onChange("Starter")}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h3 className="font-medium text-lg">Starter</h3>
                                <div className="bg-primary-light text-primary text-xs px-2 py-1 rounded-full">
                                  $9/mo
                                </div>
                              </div>
                              <ul className="text-sm text-gray-600 space-y-2">
                                <li className="flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                  Up to 5 drips/day per site
                                </li>
                                <li className="flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                  1 Splash/month total
                                </li>
                                <li className="flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                  1 website
                                </li>
                                <li className="flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                  Basic filters and analytics
                                </li>
                              </ul>
                            </div>
                            
                            {/* Grow Plan */}
                            <div
                              className={`border-2 rounded-lg p-4 cursor-pointer ${
                                field.value === "Grow" ? "border-primary bg-primary/5" : "border-gray-200"
                              }`}
                              onClick={() => field.onChange("Grow")}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h3 className="font-medium text-lg">Grow</h3>
                                <div className="bg-primary-light text-primary text-xs px-2 py-1 rounded-full">
                                  $19/mo
                                </div>
                              </div>
                              <ul className="text-sm text-gray-600 space-y-2">
                                <li className="flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                  Up to 10 drips/day per site
                                </li>
                                <li className="flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                  3 Splashes/month total
                                </li>
                                <li className="flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                  2 websites
                                </li>
                                <li className="flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                  Advanced filters and analytics
                                </li>
                              </ul>
                            </div>
                            
                            {/* Pro Plan */}
                            <div
                              className={`border-2 rounded-lg p-4 cursor-pointer ${
                                field.value === "Pro" ? "border-primary bg-primary/5" : "border-gray-200"
                              }`}
                              onClick={() => field.onChange("Pro")}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h3 className="font-medium text-lg">Pro</h3>
                                <div className="bg-primary-light text-primary text-xs px-2 py-1 rounded-full">
                                  $39/mo
                                </div>
                              </div>
                              <ul className="text-sm text-gray-600 space-y-2">
                                <li className="flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                  Up to 15 drips/day per site
                                </li>
                                <li className="flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                  7 Splashes/month total
                                </li>
                                <li className="flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                  5 websites
                                </li>
                                <li className="flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                  Full filters and analytics
                                </li>
                              </ul>
                            </div>
                            
                            {/* Free Trial */}
                            <div
                              className={`border-2 rounded-lg p-4 cursor-pointer ${
                                field.value === "Free Trial" ? "border-primary bg-primary/5" : "border-gray-200"
                              }`}
                              onClick={() => field.onChange("Free Trial")}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h3 className="font-medium text-lg">Free Trial</h3>
                                <div className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                                  14 days
                                </div>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">
                                Try all Starter plan features free for 14 days
                              </p>
                              <p className="text-xs text-gray-500">
                                No credit card required
                              </p>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button type="submit" disabled={isLoading} className="w-full">
                      {isLoading ? "Loading..." : "Continue"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
          
          {/* Step 2: Website Setup */}
          {step === 2 && (
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-2xl">Website Setup</CardTitle>
                <CardDescription>
                  Enter your website details to get started. We'll use this information to find relevant backlink opportunities.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...websiteForm}>
                  <form onSubmit={websiteForm.handleSubmit(onWebsiteSubmit)} className="space-y-6">
                    <FormField
                      control={websiteForm.control}
                      name="url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com" {...field} />
                          </FormControl>
                          <FormDescription>
                            Enter the full URL including https://.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={websiteForm.control}
                      name="niche"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website Niche</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a niche" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {NICHE_OPTIONS.map((niche) => (
                                <SelectItem key={niche} value={niche}>
                                  {niche}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Select the primary niche of your website.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={websiteForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Brief description of what your website is about"
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            This helps us better understand your website content.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button type="submit" disabled={isLoading} className="w-full">
                      {isLoading ? "Loading..." : "Continue"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
          
          {/* Step 3: Content Preferences */}
          {step === 3 && (
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-2xl">Content Preferences</CardTitle>
                <CardDescription>
                  Set your preferences for the types of backlink opportunities you'd like to receive.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...preferencesForm}>
                  <form onSubmit={preferencesForm.handleSubmit(onPreferencesSubmit)} className="space-y-6">
                    <FormField
                      control={preferencesForm.control}
                      name="linkTypes"
                      render={() => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel className="text-base">Link Types</FormLabel>
                            <FormDescription>
                              Select the types of backlink opportunities you're interested in.
                            </FormDescription>
                          </div>
                          {LINK_TYPES.map((type) => (
                            <FormField
                              key={type.id}
                              control={preferencesForm.control}
                              name="linkTypes"
                              render={({ field }) => {
                                return (
                                  <FormItem
                                    key={type.id}
                                    className="flex flex-row items-start space-x-3 space-y-0"
                                  >
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(type.id)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...field.value, type.id])
                                            : field.onChange(
                                                field.value?.filter(
                                                  (value) => value !== type.id
                                                )
                                              )
                                        }}
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal">
                                      {type.label}
                                    </FormLabel>
                                  </FormItem>
                                )
                              }}
                            />
                          ))}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={preferencesForm.control}
                      name="avoidNiches"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Niches to Avoid</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter niches you want to avoid, separated by commas"
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            We'll avoid showing opportunities from these niches.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button type="submit" disabled={isLoading} className="w-full">
                      {isLoading ? "Loading..." : "Continue"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
          
          {/* Step 4: Email Setup */}
          {step === 4 && (
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-2xl">Email Integration</CardTitle>
                <CardDescription>
                  Set up your email to send outreach messages to potential backlink partners.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...emailSetupForm}>
                  <form onSubmit={emailSetupForm.handleSubmit(onEmailSetupSubmit)} className="space-y-6">
                    <FormField
                      control={emailSetupForm.control}
                      name="provider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Provider</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a provider" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="sendgrid">SendGrid</SelectItem>
                              <SelectItem value="smtp">SMTP</SelectItem>
                              <SelectItem value="gmail">Gmail</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose how you want to send outreach emails.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={emailSetupForm.control}
                      name="fromEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>From Email</FormLabel>
                          <FormControl>
                            <Input placeholder="you@example.com" {...field} />
                          </FormControl>
                          <FormDescription>
                            This email will be used as the sender for outreach emails.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={emailSetupForm.control}
                      name="fromName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>From Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your Name" {...field} />
                          </FormControl>
                          <FormDescription>
                            The name that will appear as the sender.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {emailSetupForm.watch("provider") !== "gmail" && (
                      <FormField
                        control={emailSetupForm.control}
                        name="apiKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>API Key</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Your API key" {...field} />
                            </FormControl>
                            <FormDescription>
                              {emailSetupForm.watch("provider") === "sendgrid"
                                ? "Your SendGrid API key"
                                : "Your SMTP password"}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    
                    <FormField
                      control={emailSetupForm.control}
                      name="termsAccepted"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              I accept the terms and conditions
                            </FormLabel>
                            <FormDescription>
                              I agree to abide by email anti-spam regulations and the LinkDripAI terms of service.
                            </FormDescription>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                      {websites.length < getWebsiteLimit() && (
                        <Button 
                          onClick={addAnotherWebsite}
                          variant="outline"
                          className="flex-1 border-primary text-primary hover:bg-primary/5"
                          disabled={isLoading}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                            <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Add Another Website
                        </Button>
                      )}
                      
                      <Button 
                        type="submit"
                        className="flex-1"
                        disabled={isLoading}
                      >
                        {isLoading ? "Finishing Setup..." : "Complete Setup"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      
      {/* Show Goal Steps after step 1 */}
      {step > 1 && <OnboardingGoalSteps currentStep={step} />}
    </div>
  );
}