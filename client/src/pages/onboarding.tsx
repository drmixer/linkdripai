import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import { Progress } from "@/components/ui/progress";
import { Loader2, Link2Icon, ArrowRight, Check } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Logo from "@/components/logo";

// Subscription plan schema
const subscriptionSchema = z.object({
  plan: z.enum(["Free Trial", "Starter", "Grow", "Pro"], {
    required_error: "Please select a subscription plan",
  }),
});

const websiteSchema = z.object({
  url: z.string().url("Please enter a valid URL").min(1, "Website URL is required"),
  niche: z.string().min(1, "Niche or topic is required"),
  description: z.string().min(1, "Please describe your audience and link goals"),
});

const preferencesSchema = z.object({
  linkTypes: z.array(z.string()).min(1, "Please select at least one type of backlink"),
  avoidNiches: z.string().optional(),
});

type SubscriptionFormValues = z.infer<typeof subscriptionSchema>;
type WebsiteFormValues = z.infer<typeof websiteSchema>;
type PreferencesFormValues = z.infer<typeof preferencesSchema>;

const linkTypeOptions = [
  { id: "guest-posts", label: "Guest Posts" },
  { id: "link-inserts", label: "Link Inserts" },
  { id: "directories", label: "Directories" },
  { id: "roundups", label: "Roundups" },
  { id: "resource-pages", label: "Resource Pages" },
  { id: "broken-link-building", label: "Broken Link Building" },
  { id: "skyscraper", label: "Skyscraper Opportunities" },
];

// Pricing plans
const pricingPlans = [
  {
    id: "Free Trial",
    name: "Free Trial",
    price: "Free",
    description: "Try out our platform for 7 days",
    features: [
      "5 opportunities per day",
      "Unlock all opportunity details",
      "1 Splash per month",
      "1 website",
      "Basic email templates",
    ],
  },
  {
    id: "Starter",
    name: "Starter",
    price: "$39",
    description: "Perfect for individuals and small websites",
    features: [
      "10 opportunities per day",
      "Unlock all opportunity details",
      "1 Splash per month",
      "1 website",
      "Custom email templates",
      "Email tracking",
    ],
  },
  {
    id: "Grow",
    name: "Grow",
    price: "$69",
    description: "For growing websites and small businesses",
    features: [
      "20 opportunities per day",
      "Unlock all opportunity details",
      "3 Splashes per month",
      "2 websites",
      "Advanced opportunity filtering",
      "Response rate analytics",
    ],
  },
  {
    id: "Pro",
    name: "Pro",
    price: "$129",
    description: "For serious SEO professionals and agencies",
    features: [
      "30 opportunities per day",
      "Unlock all opportunity details",
      "5 Splashes per month",
      "5 websites",
      "Priority support",
      "White label reporting",
    ],
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(4);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("Free Trial");
  const [websites, setWebsites] = useState<WebsiteFormValues[]>([]);
  const [currentWebsiteIndex, setCurrentWebsiteIndex] = useState(0);
  const [preferences, setPreferences] = useState<(PreferencesFormValues & { websiteId: number })[]>([]);
  const { user } = useAuth();
  const [_, navigate] = useLocation();

  // Initialize subscription form
  const subscriptionForm = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      plan: "Free Trial",
    },
  });

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

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    } else if (user.onboardingCompleted) {
      // If onboarding is already complete, redirect to dashboard
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // Determine max websites based on subscription
  const getMaxWebsites = () => {
    switch (selectedPlan) {
      case 'Pro': return 5;
      case 'Grow': return 2;
      default: return 1;
    }
  };

  const maxWebsites = getMaxWebsites();

  const getDailyOpportunities = () => {
    switch (selectedPlan) {
      case 'Pro': return '10-15';
      case 'Grow': return '7-10';
      case 'Starter': return '3-5';
      default: return '3-5';
    }
  };

  const getSplashesPerMonth = () => {
    switch (selectedPlan) {
      case 'Pro': return 7;
      case 'Grow': return 3;
      case 'Starter': return 1;
      default: return 1;
    }
  };
  
  const getMonthlySplashes = getSplashesPerMonth;

  const onSubscriptionSubmit = async (data: SubscriptionFormValues) => {
    try {
      setIsLoading(true);
      setSelectedPlan(data.plan);
      
      // Move to website setup step
      setStep(2);
    } catch (error) {
      console.error("Error setting subscription:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const onWebsiteSubmit = async (data: WebsiteFormValues) => {
    try {
      setIsLoading(true);
      
      // Save websites to user record
      const newWebsites = [...websites, data];
      setWebsites(newWebsites);
      
      // Save to the database
      await apiRequest("POST", "/api/onboarding/websites", { websites: newWebsites });
      
      if (newWebsites.length < maxWebsites) {
        // If user can add more websites, ask if they want to
        setStep(3);
      } else {
        // If they've reached their limit, move to the preferences step
        setStep(4);
      }
      
      websiteForm.reset({
        url: "",
        niche: "",
        description: "",
      });
    } catch (error) {
      console.error("Error saving website:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const onPreferencesSubmit = async (data: PreferencesFormValues) => {
    try {
      setIsLoading(true);
      
      // Store preferences for the current website
      const websitePreference = {
        ...data,
        websiteId: currentWebsiteIndex,
      };
      
      const newPreferences = [...preferences];
      newPreferences[currentWebsiteIndex] = websitePreference;
      setPreferences(newPreferences);
      
      // Save preference to the database
      await apiRequest("POST", `/api/onboarding/preferences`, {
        websiteIndex: currentWebsiteIndex,
        preferences: data,
      });
      
      // Complete onboarding
      await apiRequest("POST", "/api/onboarding/complete", {});
      
      // Update cached user data
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Navigate to the dashboard
      navigate("/dashboard");
    } catch (error) {
      console.error("Error saving preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAnother = (wantToAdd: boolean) => {
    if (wantToAdd) {
      setStep(2);
    } else {
      // If they don't want to add more, but they've added at least one, go to preferences
      if (websites.length > 0) {
        setStep(4);
      }
    }
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
      
      {/* Progress Bar */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-500">Step {step} of {totalSteps}</span>
          <span className="text-sm font-medium text-gray-500">{Math.round((step / totalSteps) * 100)}% Complete</span>
        </div>
        <Progress value={(step / totalSteps) * 100} className="h-2" />
      </div>
      
      {/* Onboarding Content */}
      <div className="container mx-auto px-4 py-6 flex-1 flex items-center justify-center">
        <div className="w-full max-w-3xl">
          {/* Step 1: Website Setup */}
          {step === 1 && (
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
                            <Input 
                              placeholder="https://example.com" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Enter the full URL including https://
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
                          <FormLabel>Niche or Topic</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="E.g., Digital Marketing, Fitness, Technology" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            What is the main focus of your website?
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
                          <FormLabel>Audience & Link Goals</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe your audience and what you hope to achieve with backlinks" 
                              className="min-h-[100px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            This helps us tailor opportunities to your specific needs
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Save & Continue
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
          
          {/* Step 2: Add Another Website? */}
          {step === 2 && (
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-2xl">Add Another Website?</CardTitle>
                <CardDescription>
                  Your plan allows you to manage {maxWebsites} {maxWebsites === 1 ? "website" : "websites"}. 
                  You've added {websites.length} so far.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center p-4 mb-4 text-green-800 border border-green-100 rounded-lg bg-green-50">
                  <Check className="h-5 w-5 mr-2 text-green-500" />
                  <span>Website "{websites[websites.length - 1].url}" has been added successfully!</span>
                </div>
                
                <p className="text-gray-500">
                  Would you like to add another website now? You can always add more later.
                </p>
                
                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                  <Button 
                    onClick={() => handleAddAnother(true)}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    Yes, Add Another Website
                  </Button>
                  <Button
                    onClick={() => handleAddAnother(false)}
                    variant="outline"
                    className="flex-1"
                    disabled={isLoading}
                  >
                    No, Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Step 3: Target Preferences */}
          {step === 3 && (
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-2xl">Target Preferences</CardTitle>
                <CardDescription>
                  Set your preferences for {websites[currentWebsiteIndex].url}
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
                            <FormLabel>What types of backlinks are you interested in?</FormLabel>
                            <FormDescription>
                              Select all that apply
                            </FormDescription>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {linkTypeOptions.map((option) => (
                              <FormField
                                key={option.id}
                                control={preferencesForm.control}
                                name="linkTypes"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={option.id}
                                      className="flex flex-row items-start space-x-3 space-y-0 border rounded-md p-3"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(option.id)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...field.value, option.id])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) => value !== option.id
                                                  )
                                                )
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal cursor-pointer">
                                        {option.label}
                                      </FormLabel>
                                    </FormItem>
                                  )
                                }}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={preferencesForm.control}
                      name="avoidNiches"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Any niches or domains to avoid?</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="E.g., gambling, adult content, competitor domains" 
                              className="min-h-[80px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={preferencesForm.control}
                      name="dripPriorities"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Drip Priorities</FormLabel>
                          <FormDescription>
                            Pick up to 3 backlink types to receive more often
                          </FormDescription>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                            {linkTypeOptions.map((option) => (
                              <FormItem
                                key={option.id}
                                className="flex flex-row items-start space-x-3 space-y-0 border rounded-md p-3"
                              >
                                <FormControl>
                                  <Checkbox
                                    disabled={
                                      !field.value?.includes(option.id) &&
                                      field.value?.length >= 3
                                    }
                                    checked={field.value?.includes(option.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, option.id])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== option.id
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {option.label}
                                </FormLabel>
                              </FormItem>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Save & Continue
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
          
          {/* Step 4: Dashboard Preview */}
          {step === 4 && (
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-2xl">Dashboard Preview</CardTitle>
                <CardDescription>
                  Here's what you'll see each day in your dashboard
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="border rounded-lg p-6 bg-white">
                  <h3 className="text-lg font-medium mb-4">Daily Opportunities</h3>
                  
                  <div className="space-y-4">
                    <div className="border rounded-md p-4 bg-gray-50">
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">Guest Post Opportunity</span>
                        <span className="text-sm bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">92% Fit</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <span className="text-gray-500">Niche:</span> Digital Marketing
                        </div>
                        <div>
                          <span className="text-gray-500">DA:</span> 54
                        </div>
                        <div>
                          <span className="text-gray-500">Category:</span> SaaS
                        </div>
                        <div>
                          <span className="text-gray-500">Traffic:</span> 80K/mo
                        </div>
                      </div>
                      <div className="flex items-center justify-center p-3 border border-dashed rounded-md bg-gray-100 mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span className="text-sm text-gray-500">All opportunities are now unlocked by default</span>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" className="w-full">Save for Later</Button>
                        <Button size="sm" className="w-full">View Details</Button>
                      </div>
                    </div>
                    
                    <div className="text-center text-gray-500 text-sm">
                      <p>You'll receive {getDailyOpportunities()} fresh opportunities like this every day</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-primary-50 border border-primary-100 rounded-lg p-4">
                  <h3 className="font-medium text-primary-800 mb-2">Your Plan Benefits</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    All opportunities and contact details are now unlocked by default. Your {user?.subscription || "Free Trial"} plan includes:
                  </p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                    <li>{getDailyOpportunities()} opportunities per day</li>
                    <li>{getMonthlySplashes()} Splashes per month</li>
                    <li>Unlimited AI-generated emails</li>
                    <li>Splashes reset each billing cycle</li>
                  </ul>
                </div>
                
                <Button 
                  onClick={() => setStep(5)}
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Continue to Final Step
                </Button>
              </CardContent>
            </Card>
          )}
          
          {/* Step 5: Ready to Go */}
          {step === 5 && (
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-2xl">You're All Set!</CardTitle>
                <CardDescription>
                  Your LinkDripAI account is now fully configured
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-green-50 border border-green-100 rounded-lg p-6 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Congratulations, {user?.firstName}!</h3>
                  <p className="text-gray-600 mb-4">
                    We'll start delivering personalized opportunities to your dashboard right away.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="border rounded-md p-3 bg-white">
                      <div className="text-2xl font-bold text-primary-600 mb-1">{websites.length}</div>
                      <div className="text-sm text-gray-500">Websites Added</div>
                    </div>
                    <div className="border rounded-md p-3 bg-white">
                      <div className="text-2xl font-bold text-primary-600 mb-1">{getDailyOpportunities()}</div>
                      <div className="text-sm text-gray-500">Daily Opportunities</div>
                    </div>
                    <div className="border rounded-md p-3 bg-white">
                      <div className="text-2xl font-bold text-primary-600 mb-1">{getMonthlySplashes()}</div>
                      <div className="text-sm text-gray-500">Monthly Splashes</div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-500">
                    You can always adjust your site preferences, add more sites (if eligible), or upgrade as you grow.
                  </p>
                </div>
                
                <Button 
                  onClick={() => navigate("/dashboard")}
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}