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
import { Loader2, ArrowRight, Check, Globe, PanelRight, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

const websiteSchema = z.object({
  url: z.string().url("Please enter a valid URL").min(1, "Website URL is required"),
  niche: z.string().min(1, "Niche is required"),
  description: z.string().min(1, "Description is required"),
});

const preferencesSchema = z.object({
  linkTypes: z.array(z.string()).min(1, "Select at least one type of backlink"),
  avoidNiches: z.string().optional(),
  competitors: z.array(z.string()).default([]),
  dripPriorities: z.array(z.string()).default(["high_da", "relevance", "opportunity_type"]),
});

type WebsiteFormValues = z.infer<typeof websiteSchema>;
type PreferencesFormValues = z.infer<typeof preferencesSchema>;

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(4); // Added email setup step
  const [isLoading, setIsLoading] = useState(false);
  const [websites, setWebsites] = useState<WebsiteFormValues[]>([]);
  const [currentWebsiteIndex, setCurrentWebsiteIndex] = useState(0);
  const [preferences, setPreferences] = useState<(PreferencesFormValues & { websiteId: number })[]>([]);
  const { user } = useAuth();
  const [_, navigate] = useLocation();
  const { toast } = useToast();

  // Get the selected plan from user data or localStorage as fallback
  const [selectedPlan, setSelectedPlan] = useState(() => {
    // First check if we have the plan in the user object
    if (user?.subscription) {
      return user.subscription;
    }
    
    // Then try localStorage
    if (typeof window !== 'undefined') {
      const savedPlan = localStorage.getItem('selectedPlan');
      if (savedPlan) {
        return savedPlan;
      }
    }
    
    // Default to Free Trial
    return "Free Trial";
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
      competitors: [""],
      dripPriorities: ["high_da", "relevance", "opportunity_type"],
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
  
  // Debug the plan selection
  useEffect(() => {
    console.log("Selected plan from localStorage:", localStorage.getItem('selectedPlan'));
    console.log("Selected plan from state:", selectedPlan);
    console.log("User subscription from server:", user?.subscription);
    
    // Force update the plan from localStorage if needed
    const storedPlan = localStorage.getItem('selectedPlan');
    if (storedPlan && (storedPlan === "Grow" || storedPlan === "Pro" || storedPlan === "Starter")) {
      setSelectedPlan(storedPlan);
    }
  }, []);

  const onWebsiteSubmit = async (data: WebsiteFormValues) => {
    setIsLoading(true);
    try {
      // Double-check that we have the correct plan
      const storedPlan = localStorage.getItem('selectedPlan');
      if (storedPlan && (storedPlan === "Grow" || storedPlan === "Pro" || storedPlan === "Starter")) {
        setSelectedPlan(storedPlan);
        console.log("Updated selected plan to:", storedPlan);
      }

      // Add the new website
      const newWebsites = [...websites, data];
      setWebsites(newWebsites);
      
      // Update the website index for preferences
      setCurrentWebsiteIndex(newWebsites.length - 1);
      
      // Reset preferences form with appropriate defaults based on plan
      const storedPlanForReset = localStorage.getItem('selectedPlan') || selectedPlan;
      if (storedPlanForReset === "Grow") {
        preferencesForm.reset({
          linkTypes: [],
          avoidNiches: "",
          competitors: [""], // Grow plan: 1 competitor field
          dripPriorities: ["high_da", "relevance", "opportunity_type"],
        });
      } else if (storedPlanForReset === "Pro") {
        preferencesForm.reset({
          linkTypes: [],
          avoidNiches: "",
          competitors: ["", "", ""], // Pro plan: 3 competitor fields
          dripPriorities: ["high_da", "relevance", "opportunity_type"],
        });
      }
      
      // Move to preferences step
      setStep(2);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to save website information",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onPreferencesSubmit = async (data: PreferencesFormValues) => {
    setIsLoading(true);
    try {
      // Store preferences for the current website
      setPreferences([...preferences, { ...data, websiteId: currentWebsiteIndex }]);
      
      // Move to the review step
      setStep(3);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addAnotherWebsite = () => {
    // Get the actual plan from localStorage or state
    const actualPlan = localStorage.getItem('selectedPlan') || selectedPlan;
    
    // Check if user can add more websites based on their plan
    let maxWebsites = 1; // Default for Starter plan
    
    if (actualPlan === "Grow") {
      maxWebsites = 2;
    } else if (actualPlan === "Pro") {
      maxWebsites = 5;
    } else if (actualPlan === "Free Trial") {
      maxWebsites = 1;
    }
    
    if (websites.length >= maxWebsites) {
      toast({
        title: "Plan Limit Reached",
        description: `Your ${actualPlan} plan supports up to ${maxWebsites} websites. Upgrade to add more.`,
        variant: "destructive",
      });
      return;
    }
    
    // Update selected plan from localStorage if needed
    const storedPlan = localStorage.getItem('selectedPlan');
    if (storedPlan && (storedPlan === "Grow" || storedPlan === "Pro" || storedPlan === "Starter")) {
      setSelectedPlan(storedPlan);
    }
    
    // Reset the website form
    websiteForm.reset({
      url: "",
      niche: "",
      description: "",
    });
    
    // Go back to the website step
    setStep(1);
  };

  const finishOnboarding = async () => {
    setIsLoading(true);
    try {
      // Create websites with preferences
      const websitesWithPreferences = websites.map((website, index) => {
        const websitePreferences = preferences.find(p => p.websiteId === index);
        return {
          ...website,
          preferences: websitePreferences ? {
            linkTypes: websitePreferences.linkTypes,
            avoidNiches: websitePreferences.avoidNiches,
            competitors: websitePreferences.competitors?.filter(c => c !== '') || [],
            dripPriorities: websitePreferences.dripPriorities || ["high_da", "relevance", "opportunity_type"],
          } : undefined,
        };
      });
      
      // Save all websites in one request
      await fetch("/api/user/websites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ websites: websitesWithPreferences }),
      });
      
      // Mark onboarding as complete - ensure the API called successfully
      const completeResponse = await fetch("/api/onboarding/complete", {
        method: "POST",
      });
      
      if (!completeResponse.ok) {
        throw new Error("Failed to mark onboarding as complete");
      }
      
      // Force refresh the user data to make sure the flag is updated
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      toast({
        title: "Setup complete!",
        description: "You're all set to start using LinkDripAI",
      });
      
      // Clear selectedPlan from localStorage after successful onboarding
      localStorage.removeItem('selectedPlan');
      
      // Use most direct method to get to dashboard - skip React routing entirely
      console.log("Onboarding complete! Using direct reload to dashboard...");
      
      // Set a flag in localStorage to ensure we go to dashboard after page reload
      localStorage.setItem('onboardingJustCompleted', 'true');
      localStorage.setItem('redirectAfterReload', '/dashboard');
      
      // Force a full page reload to clear any stale state
      window.location.href = '/dashboard';
      
      // Fallback with different approach after a delay
      setTimeout(() => {
        console.log("Using absolute URL fallback...");
        const baseUrl = window.location.origin;
        window.location.href = `${baseUrl}/dashboard`;
      }, 800);
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

  // List of backlink types
  const backlinkTypes = [
    { id: "guest_post", label: "Guest Posts" },
    { id: "resource_page", label: "Resource Pages" },
    { id: "broken_link", label: "Broken Link Building" },
    { id: "skyscraper", label: "Skyscraper Opportunities" },
    { id: "roundup", label: "Weekly/Monthly Roundups" },
    { id: "testimonial", label: "Testimonial Links" },
    { id: "comment", label: "Blog Comments" },
    { id: "forum", label: "Forum Posts" },
    { id: "directory", label: "Directories" },
  ];

  // Get the current website
  const currentWebsite = websites[currentWebsiteIndex];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header with modern design */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 shadow-sm">
        <div className="container mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center cursor-pointer hover:opacity-90 transition-opacity">
            <div className="rounded-md bg-primary p-1.5 mr-2.5">
              <Link2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">LinkDripAI</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Need help?</span>
            <Button variant="outline" size="sm" className="border-gray-200 gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.09 9C9.3251 8.33167 9.78915 7.76811 10.4 7.40913C11.0108 7.05016 11.7289 6.91894 12.4272 7.03871C13.1255 7.15849 13.7588 7.52152 14.2151 8.06353C14.6713 8.60553 14.9211 9.29152 14.92 10C14.92 12 11.92 13 11.92 13M12 17H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Support
            </Button>
          </div>
        </div>
      </header>
      
      {/* Progress Bar with enhanced visual style */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-3">
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
                            <Input placeholder="https://example.com" {...field} />
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
                          <FormLabel>Website Niche/Industry</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Finance, Health, Technology" {...field} />
                          </FormControl>
                          <FormDescription>
                            This helps us find relevant opportunities in your industry
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
                              placeholder="Briefly describe what your website is about..."
                              className="resize-none h-24"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            A brief description helps us understand your content and goals
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
                      Continue <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
          
          {/* Step 2: Link-Building Preferences */}
          {step === 2 && (
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-2xl">Link-Building Preferences</CardTitle>
                <CardDescription>
                  Help us understand what types of backlink opportunities you're interested in for {currentWebsite?.url}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...preferencesForm}>
                  <form onSubmit={preferencesForm.handleSubmit(onPreferencesSubmit)} className="space-y-6">
                    <div className="space-y-2">
                      <div className="mb-2">
                        <div className="text-sm font-medium">Types of Backlinks</div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Select the types of backlinks you're interested in pursuing.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {backlinkTypes.map((type) => {
                          const isSelected = preferencesForm.getValues().linkTypes?.includes(type.id);
                          return (
                            <div 
                              key={type.id}
                              className={`flex items-center space-x-3 rounded-md border p-4 cursor-pointer ${isSelected ? 'border-primary bg-primary/5' : ''}`}
                              onClick={() => {
                                const currentValues = preferencesForm.getValues().linkTypes || [];
                                if (currentValues.includes(type.id)) {
                                  preferencesForm.setValue('linkTypes', 
                                    currentValues.filter(value => value !== type.id),
                                    { shouldValidate: true }
                                  );
                                } else {
                                  preferencesForm.setValue('linkTypes', 
                                    [...currentValues, type.id],
                                    { shouldValidate: true }
                                  );
                                }
                              }}
                            >
                              <div className={`h-4 w-4 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                                {isSelected && (
                                  <svg 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    width="10" 
                                    height="10" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                    className="text-white"
                                  >
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                )}
                              </div>
                              <span className="font-normal">
                                {type.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {preferencesForm.formState.errors.linkTypes && (
                        <p className="text-sm font-medium text-destructive mt-2">
                          {preferencesForm.formState.errors.linkTypes.message}
                        </p>
                      )}
                    </div>
                    
                    {/* Competitor section - only shown for Grow and Pro plans */}
                    {(() => {
                      const actualPlan = localStorage.getItem('selectedPlan') || selectedPlan;
                      return (actualPlan === "Grow" || actualPlan === "Pro");
                    })() && (
                      <div className="mt-8 pt-6 border-t border-gray-100">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="bg-primary/10 p-1.5 rounded-md">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M22 12H18L15 21L9 3L6 12H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <h3 className="text-lg font-medium">Competitor Tracking</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                          Your {localStorage.getItem('selectedPlan') || selectedPlan} plan includes competitor tracking. 
                          {(() => {
                            const actualPlan = localStorage.getItem('selectedPlan') || selectedPlan;
                            return actualPlan === "Grow" ? 
                              " You can track 1 competitor website to analyze their backlink profile." : 
                              " You can track up to 3 competitor websites to analyze their backlink profiles.";
                          })()}
                        </p>
                        
                        <FormField
                          control={preferencesForm.control}
                          name="competitors"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Competitor Websites (Optional)</FormLabel>
                              <FormControl>
                                <div className="space-y-3">
                                  {field.value.concat(['']).map((url, index) => (
                                    index < (() => {
                                      const actualPlan = localStorage.getItem('selectedPlan') || selectedPlan;
                                      if (actualPlan === "Grow") return 1; // Grow plan: 1 competitor
                                      if (actualPlan === "Pro") return 3;  // Pro plan: 3 competitors
                                      return 0; // Default (shouldn't show any for other plans)
                                    })() && (
                                      <div key={index} className="flex gap-2">
                                        <Input 
                                          placeholder="https://competitor.com"
                                          value={url}
                                          onChange={(e) => {
                                            const newCompetitors = [...field.value];
                                            // If this is the last empty input and user types something, add a new empty input
                                            if (index === field.value.length) {
                                              newCompetitors.push(e.target.value);
                                            } else {
                                              newCompetitors[index] = e.target.value;
                                            }
                                            // Remove any empty values except the last one
                                            field.onChange(newCompetitors.filter((val, i) => 
                                              val !== '' || i === newCompetitors.length - 1
                                            ));
                                          }}
                                          className="flex-1"
                                        />
                                        
                                        {index < field.value.length && (
                                          <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="icon"
                                            className="text-gray-400 hover:text-red-500"
                                            onClick={() => {
                                              const newValues = [...field.value];
                                              newValues.splice(index, 1);
                                              field.onChange(newValues);
                                            }}
                                          >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                          </Button>
                                        )}
                                      </div>
                                    )
                                  ))}
                                </div>
                              </FormControl>
                              <FormDescription>
                                {(() => {
                                  const actualPlan = localStorage.getItem('selectedPlan') || selectedPlan;
                                  if (actualPlan === "Grow") return "Your Grow plan allows tracking 1 competitor website";
                                  if (actualPlan === "Pro") return "Your Pro plan allows tracking up to 3 competitor websites";
                                  return ""; // Default shouldn't happen
                                })()}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                    
                    <FormField
                      control={preferencesForm.control}
                      name="avoidNiches"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Niches to Avoid (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="e.g. Gambling, Adult content, Cryptocurrencies"
                              className="resize-none h-20"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            List any niches or industries you want to avoid when building backlinks
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
                      Continue <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
          
          {/* Step 3: Review & Finish */}
          {step === 3 && (
            <Card className="w-full shadow-md border-0">
              <CardHeader className="border-b border-gray-100 pb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Almost Done!</CardTitle>
                    <CardDescription className="text-gray-500">
                      Review your details before completing the setup
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-8">
                <div className="space-y-8">
                  {/* Plan Summary */}
                  <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-full bg-white shadow-sm">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M16 4H8C7.44772 4 7 4.44772 7 5V19C7 19.5523 7.44772 20 8 20H16C16.5523 20 17 19.5523 17 19V5C17 4.44772 16.5523 4 16 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M11 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900">Your Plan: {localStorage.getItem('selectedPlan') || selectedPlan}</h3>
                          {(() => {
                            // Get the actual plan from localStorage or state
                            const actualPlan = localStorage.getItem('selectedPlan') || selectedPlan;
                            
                            if (actualPlan === "Free Trial") {
                              return (
                                <div className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                                  7 days
                                </div>
                              );
                            } else if (actualPlan === "Starter") {
                              return (
                                <div className="px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                                  $9/month
                                </div>
                              );
                            } else if (actualPlan === "Grow") {
                              return (
                                <div className="px-3 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                                  $19/month
                                </div>
                              );
                            } else if (actualPlan === "Pro") {
                              return (
                                <div className="px-3 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">
                                  $39/month
                                </div>
                              );
                            }
                            
                            return null;
                          })()}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="text-sm font-medium text-gray-500">Opportunities</div>
                            <div className="font-bold text-xl text-gray-900">
                              {(() => {
                                // Get actual plan from localStorage or state
                                const actualPlan = localStorage.getItem('selectedPlan') || selectedPlan;
                                
                                if (actualPlan === "Free Trial") return "3-5";
                                if (actualPlan === "Starter") return "3-5";
                                if (actualPlan === "Grow") return "7-10";
                                if (actualPlan === "Pro") return "10-15";
                                return "5"; // Default
                              })()}
                              <span className="text-sm font-normal text-gray-500"> / day</span>
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="text-sm font-medium text-gray-500">Splashes</div>
                            <div className="font-bold text-xl text-gray-900">
                              {(() => {
                                // Get actual plan from localStorage or state
                                const actualPlan = localStorage.getItem('selectedPlan') || selectedPlan;
                                
                                if (actualPlan === "Free Trial") return "1";
                                if (actualPlan === "Starter") return "1";
                                if (actualPlan === "Grow") return "3";
                                if (actualPlan === "Pro") return "7";
                                return "1"; // Default
                              })()}
                              <span className="text-sm font-normal text-gray-500">
                                {(localStorage.getItem('selectedPlan') || selectedPlan) === "Free Trial" ? " total" : " / month"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Website Summary */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">Your Website{websites.length > 1 ? "s" : ""}</h3>
                        <div className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          {websites.length} / 
                          {(() => {
                            const actualPlan = localStorage.getItem('selectedPlan') || selectedPlan;
                            if (actualPlan === "Starter") return "1";
                            if (actualPlan === "Grow") return "2";
                            if (actualPlan === "Pro") return "5";
                            return "1"; // Default for Free Trial
                          })()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {websites.map((site, index) => {
                        const sitePrefs = preferences.find(p => p.websiteId === index);
                        return (
                          <div key={index} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                            <div className="flex items-start gap-4">
                              <div className="bg-primary/10 p-2.5 rounded-md flex-shrink-0">
                                <Globe className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900">{site.url}</div>
                                <div className="text-sm text-gray-600 mt-1">
                                  <span className="font-medium">Niche:</span> {site.niche}
                                </div>
                                <div className="text-sm mt-2 text-gray-600">{site.description}</div>
                                
                                {sitePrefs && (
                                  <div className="mt-4 pt-4 border-t border-gray-100">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="p-1 rounded-full bg-primary/10">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                          <path d="M8 6H21M8 12H21M8 18H21M3 6H3.01M3 12H3.01M3 18H3.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                      </div>
                                      <div className="text-sm font-medium text-gray-900">Selected Link Types</div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {sitePrefs.linkTypes.map(type => (
                                        <span key={type} className="px-3 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">
                                          {backlinkTypes.find(t => t.id === type)?.label || type}
                                        </span>
                                      ))}
                                    </div>
                                    
                                    {/* Show competitor tracking section for Grow and Pro plans */}
                                    {(() => {
                                      const actualPlan = localStorage.getItem('selectedPlan') || selectedPlan;
                                      return (actualPlan === "Grow" || actualPlan === "Pro") && 
                                        sitePrefs.competitors && 
                                        sitePrefs.competitors.length > 0 && 
                                        sitePrefs.competitors.some(c => c);
                                    })() && (
                                      <div className="mt-4">
                                        <div className="flex items-center gap-2 mb-2">
                                          <div className="p-1 rounded-full bg-primary/10">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                              <path d="M22 12H18L15 21L9 3L6 12H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                          </div>
                                          <div className="text-sm font-medium text-gray-900">Competitor Tracking</div>
                                        </div>
                                        <div className="ml-7">
                                          {sitePrefs.competitors.filter(c => c).map((competitor, i) => (
                                            <div key={i} className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                                              <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                                              {competitor}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {sitePrefs.avoidNiches && (
                                      <div className="mt-4">
                                        <div className="flex items-center gap-2 mb-2">
                                          <div className="p-1 rounded-full bg-red-100">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                              <path d="M12 9V12M12 15H12.01M5.07183 19H18.9282C20.4678 19 21.4301 17.3333 20.6603 16L13.7321 4C12.9623 2.66667 11.0378 2.66667 10.268 4L3.33978 16C2.56998 17.3333 3.53223 19 5.07183 19Z" stroke="#E11D48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                          </div>
                                          <div className="text-sm font-medium text-gray-900">Niches to Avoid</div>
                                        </div>
                                        <div className="ml-7 text-sm text-gray-600 mt-1">{sitePrefs.avoidNiches}</div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    {websites.length < (() => {
                      const actualPlan = localStorage.getItem('selectedPlan') || selectedPlan;
                      if (actualPlan === "Starter") return 1;
                      if (actualPlan === "Grow") return 2;
                      if (actualPlan === "Pro") return 5;
                      return 1; // Default for Free Trial
                    })() && (
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
                      onClick={finishOnboarding}
                      className="flex-1 sm:flex-[2] bg-gradient-to-r from-primary to-primary-light hover:from-primary/90 hover:to-primary-light/90 shadow-sm"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      ) : null}
                      Complete Setup & Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mt-4 bg-gray-50 p-3 rounded-lg">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M13 16H12V12H11M12 8H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p>
                      You can always adjust your site preferences, add more websites, or upgrade your plan later.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}