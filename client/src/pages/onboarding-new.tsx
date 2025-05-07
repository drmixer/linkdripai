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
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
      "10 credits",
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
      "50 credits per month",
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
      "150 credits per month",
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
      "300 credits per month",
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

  // Initialize subscription form with the selected plan from localStorage
  const subscriptionForm = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      plan: selectedPlan,
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
      case 'Pro': return 30;
      case 'Grow': return 20;
      case 'Starter': return 10;
      default: return 5;
    }
  };

  const getMonthlyCredits = () => {
    switch (selectedPlan) {
      case 'Pro': return 300;
      case 'Grow': return 150;
      case 'Starter': return 50;
      default: return 10;
    }
  };

  const onSubscriptionSubmit = async (data: SubscriptionFormValues) => {
    try {
      setIsLoading(true);
      
      // Update the selected plan
      setSelectedPlan(data.plan);
      
      // Update the user's subscription in the database
      await apiRequest("POST", "/api/onboarding/subscription", { plan: data.plan });
      
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
      
      // Clear the selectedPlan from localStorage
      localStorage.removeItem('selectedPlan');
      
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
          <div className="rounded-md bg-primary p-1.5 mr-2">
            <Link2Icon className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">LinkSyncOS</span>
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
                        <FormItem className="space-y-4">
                          <FormLabel>Subscription Plan</FormLabel>
                          <FormControl>
                            <RadioGroup 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                              className="grid grid-cols-1 md:grid-cols-2 gap-4"
                            >
                              {pricingPlans.map((plan) => (
                                <Label
                                  htmlFor={plan.id}
                                  key={plan.id}
                                  className={`
                                    flex flex-col p-4 border rounded-lg cursor-pointer transition-all
                                    ${field.value === plan.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}
                                  `}
                                >
                                  <RadioGroupItem 
                                    value={plan.id} 
                                    id={plan.id} 
                                    className="sr-only" 
                                  />
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <h3 className="font-medium text-lg">{plan.name}</h3>
                                      <p className="text-sm text-gray-500">{plan.description}</p>
                                    </div>
                                    {field.value === plan.id && (
                                      <Check className="h-5 w-5 text-primary" />
                                    )}
                                  </div>
                                  <div className="mt-2 mb-4">
                                    <span className="text-2xl font-bold">{plan.price}</span>
                                    {plan.id !== "Free Trial" && <span className="text-sm text-gray-500">/month</span>}
                                  </div>
                                  <ul className="space-y-2 mt-auto">
                                    {plan.features.map((feature, index) => (
                                      <li key={index} className="flex items-center text-sm">
                                        <Check className="h-4 w-4 mr-2 text-green-500" />
                                        {feature}
                                      </li>
                                    ))}
                                  </ul>
                                </Label>
                              ))}
                            </RadioGroup>
                          </FormControl>
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
                      Continue
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
          
          {/* Step 3: Add Another Website? */}
          {step === 3 && (
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-2xl">Add Another Website?</CardTitle>
                <CardDescription>
                  Your {selectedPlan} plan allows you to manage {maxWebsites} {maxWebsites === 1 ? "website" : "websites"}. 
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
          
          {/* Step 4: Target Preferences */}
          {step === 4 && (
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
                              Select all that apply. These will be prioritized in your daily opportunities.
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
                          <FormLabel>Niches to avoid (optional)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="E.g., Gambling, Adult content" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            We'll avoid finding opportunities from these niches
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
                      Complete Setup
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}