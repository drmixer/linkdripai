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
import { Loader2, ArrowRight, Check, Globe, PanelRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const websiteSchema = z.object({
  url: z.string().url("Please enter a valid URL").min(1, "Website URL is required"),
  niche: z.string().min(1, "Niche is required"),
  description: z.string().min(1, "Description is required"),
});

const preferencesSchema = z.object({
  linkTypes: z.array(z.string()).min(1, "Select at least one type of backlink"),
  avoidNiches: z.string().optional(),
  dripPriorities: z.array(z.string()).default(["high_da", "relevance", "opportunity_type"]),
});

type WebsiteFormValues = z.infer<typeof websiteSchema>;
type PreferencesFormValues = z.infer<typeof preferencesSchema>;

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(3); // Reduced total steps
  const [isLoading, setIsLoading] = useState(false);
  const [websites, setWebsites] = useState<WebsiteFormValues[]>([]);
  const [currentWebsiteIndex, setCurrentWebsiteIndex] = useState(0);
  const [preferences, setPreferences] = useState<(PreferencesFormValues & { websiteId: number })[]>([]);
  const { user } = useAuth();
  const [_, navigate] = useLocation();
  const { toast } = useToast();

  // Get the selected plan from user data or localStorage as fallback
  const selectedPlan = user?.subscription || (() => {
    // Fallback to localStorage if user subscription isn't set yet
    const savedPlan = typeof window !== 'undefined' ? localStorage.getItem('selectedPlan') : null;
    return savedPlan || "Free Trial";
  })();

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

  const onWebsiteSubmit = async (data: WebsiteFormValues) => {
    setIsLoading(true);
    try {
      // Add the new website
      const newWebsites = [...websites, data];
      setWebsites(newWebsites);
      
      // Update the website index for preferences
      setCurrentWebsiteIndex(newWebsites.length - 1);
      
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
    // Check if user can add more websites based on their plan
    let maxWebsites = 1; // Default for Starter plan
    
    if (selectedPlan === "Grow") {
      maxWebsites = 2;
    } else if (selectedPlan === "Pro") {
      maxWebsites = 5;
    } else if (selectedPlan === "Free Trial") {
      maxWebsites = 1;
    }
    
    if (websites.length >= maxWebsites) {
      toast({
        title: "Plan Limit Reached",
        description: `Your ${selectedPlan} plan supports up to ${maxWebsites} websites. Upgrade to add more.`,
        variant: "destructive",
      });
      return;
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
      
      // Mark onboarding as complete
      await fetch("/api/user/onboarding/complete", {
        method: "POST",
      });
      
      toast({
        title: "Setup complete!",
        description: "You're all set to start using LinkDripAI",
      });
      
      // Redirect to dashboard
      navigate("/dashboard");
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
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="container mx-auto flex items-center">
          <Link href="/" className="flex items-center cursor-pointer hover:opacity-90 transition-opacity">
            <div className="rounded-md bg-primary p-1.5 mr-2">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">LinkDripAI</span>
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
                    <FormField
                      control={preferencesForm.control}
                      name="linkTypes"
                      render={() => (
                        <FormItem>
                          <div className="mb-2">
                            <FormLabel>Types of Backlinks</FormLabel>
                            <FormDescription>
                              Select the types of backlinks you're interested in pursuing.
                            </FormDescription>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {backlinkTypes.map((type) => (
                              <FormField
                                key={type.id}
                                control={preferencesForm.control}
                                name="linkTypes"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={type.id}
                                      className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"
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
                                      <FormLabel className="font-normal cursor-pointer">
                                        {type.label}
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
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-2xl">Review & Finish</CardTitle>
                <CardDescription>
                  Review your setup details before completing the onboarding process.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {/* Plan Summary */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Your Plan</h3>
                    <div className="bg-primary/10 rounded-md p-4 mb-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{selectedPlan}</div>
                        {selectedPlan === "Free Trial" && (
                          <div className="px-2 py-1 text-xs font-medium rounded-full bg-blue-200 text-blue-800">
                            7 days
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-sm">
                        {selectedPlan === "Free Trial" && (
                          <p>5 daily opportunities, 10 total credits</p>
                        )}
                        {selectedPlan === "Starter" && (
                          <p>10 daily opportunities, 50 credits/month, 1 website</p>
                        )}
                        {selectedPlan === "Grow" && (
                          <p>20 daily opportunities, 150 credits/month, 2 websites</p>
                        )}
                        {selectedPlan === "Pro" && (
                          <p>30 daily opportunities, 300 credits/month, 5 websites</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Website Summary */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">Your Website{websites.length > 1 ? "s" : ""}</h3>
                      <div>
                        <span className="text-sm text-gray-500">
                          {websites.length} / 
                          {selectedPlan === "Starter" ? "1" : selectedPlan === "Grow" ? "2" : selectedPlan === "Pro" ? "5" : "1"}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {websites.map((site, index) => {
                        const sitePrefs = preferences.find(p => p.websiteId === index);
                        return (
                          <div key={index} className="bg-white border rounded-md p-4">
                            <div className="flex items-start gap-3">
                              <div className="bg-primary/10 p-2 rounded-md">
                                <Globe className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium">{site.url}</div>
                                <div className="text-sm text-gray-500">{site.niche}</div>
                                <div className="text-sm mt-1">{site.description}</div>
                                
                                {sitePrefs && (
                                  <div className="mt-3 pt-3 border-t border-gray-100">
                                    <div className="text-sm font-medium">Link types:</div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {sitePrefs.linkTypes.map(type => (
                                        <span key={type} className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                                          {backlinkTypes.find(t => t.id === type)?.label || type}
                                        </span>
                                      ))}
                                    </div>
                                    
                                    {sitePrefs.avoidNiches && (
                                      <div className="mt-2">
                                        <div className="text-sm font-medium">Avoiding:</div>
                                        <div className="text-sm text-gray-500 mt-1">{sitePrefs.avoidNiches}</div>
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
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      onClick={addAnotherWebsite}
                      variant="outline"
                      className="flex-1"
                      disabled={isLoading}
                    >
                      Add Another Website
                    </Button>
                    
                    <Button 
                      onClick={finishOnboarding}
                      className="flex-1 sm:flex-[2]"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                  
                  <p className="text-sm text-gray-500">
                    You can always adjust your site preferences, add more sites (if eligible), or upgrade as you grow.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}