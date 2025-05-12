import Layout from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { BuySplashesDialog } from "@/components/buy-splashes-dialog";
import { 
  CreditCard, 
  Package2, 
  Droplets, 
  Sparkles,
  Check,
  ChevronRight,
  Calendar,
  AlertCircle,
  RefreshCw,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

// For small icons within buttons (Plus and Minus)
const Plus = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M12 5v14M5 12h14"/>
  </svg>
);

const Minus = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M5 12h14"/>
  </svg>
);

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const [selectedPlan, setSelectedPlan] = useState<string>(user?.subscription || 'Free Trial');
  const [selectedSplashes, setSelectedSplashes] = useState<string>("1");
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);
  const [isPremiumSplashesDialogOpen, setIsPremiumSplashesDialogOpen] = useState(false);
  
  useEffect(() => {
    // Open Add-ons tab if navigated with ?tab=add-ons parameter
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'add-ons') {
      document.querySelector('[value="add-ons"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
      setIsPremiumSplashesDialogOpen(true);
    }
  }, [location]);
  
  // Fetch billing information
  const { data: billingInfo, isLoading: isLoadingBillingInfo } = useQuery({
    queryKey: ["/api/billing"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/billing");
      return await res.json();
    },
  });

  // Fetch user stats
  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/stats");
      return await res.json();
    },
  });

  // Update subscription mutation
  const updateSubscriptionMutation = useMutation({
    mutationFn: async (plan: string) => {
      const res = await apiRequest("POST", "/api/subscription", { plan });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing"] });
      setIsUpgradeDialogOpen(false);
      toast({
        title: "Subscription updated",
        description: `Your subscription has been updated to ${selectedPlan}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update subscription",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add Premium Splashes mutation
  const addPremiumSplashesMutation = useMutation({
    mutationFn: async (splashes: string) => {
      const res = await apiRequest("POST", "/api/premium-splashes/add", { splashes: parseInt(splashes) });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setIsPremiumSplashesDialogOpen(false);
      toast({
        title: "Premium Splashes added",
        description: `${selectedSplashes} Premium Splashes have been added to your account.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add Premium Splashes",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpgradeSubscription = () => {
    updateSubscriptionMutation.mutate(selectedPlan);
  };

  const handleAddSplashes = () => {
    addPremiumSplashesMutation.mutate(selectedSplashes);
  };

  // Plan details
  const plans = [
    {
      id: "free-trial",
      name: "Free Trial",
      description: "Try LinkDripAI for 7 days",
      price: "$0",
      features: [
        "1 website",
        "3-5 opportunities per day",
        "Unlock all opportunity details",
        "1 Premium Splash per month",
        "Basic filters and analytics",
        "Standard support",
      ],
      limits: {
        websites: 1,
        opportunities: 5,
        splashes: 1,
      },
    },
    {
      id: "starter",
      name: "Starter",
      description: "Perfect for individual bloggers and small websites",
      price: "$9",
      features: [
        "1 website",
        "3-5 opportunities per day",
        "Unlock all opportunity details",
        "1 Premium Splash per month",
        "Basic filters and analytics",
        "Standard support",
      ],
      limits: {
        websites: 1,
        opportunities: 5,
        splashes: 1,
      },
    },
    {
      id: "grow",
      name: "Grow",
      description: "Ideal for growing websites and small agencies",
      price: "$19",
      features: [
        "2 websites",
        "7-10 opportunities per day",
        "Unlock all opportunity details",
        "3 Premium Splashes per month",
        "Advanced filters and analytics",
        "Custom email templates",
        "Competitor backlink insights",
      ],
      limits: {
        websites: 2,
        opportunities: 10,
        splashes: 3,
      },
      isPopular: true,
    },
    {
      id: "pro",
      name: "Pro",
      description: "For agencies and multiple website owners",
      price: "$39",
      features: [
        "5 websites",
        "10-15 opportunities per day",
        "Unlock all opportunity details",
        "7 Premium Splashes per month",
        "Full filtering options",
        "Advanced analytics and reporting", 
        "Competitor backlink insights",
        "White-label reports",
        "Priority support",
      ],
      limits: {
        websites: 5,
        opportunities: 15,
        splashes: 7,
      },
    },
  ];

  // Current plan object - case insensitive match
  const userSubscription = user?.subscription || 'Free Trial';
  const currentPlan = plans.find(plan => 
    plan.name.toLowerCase() === userSubscription.toLowerCase()
  ) || plans[0];

  // Splash packages
  const splashPackages = [
    { value: "1", label: "1 Premium Splash", price: "$7" },
    { value: "3", label: "3 Premium Splashes", price: "$18", savings: "Save 14%" },
    { value: "7", label: "7 Premium Splashes", price: "$35", savings: "Save 29%" },
  ];

  // Calculate progress
  const splashesUsed = stats?.splashes?.total - stats?.splashes?.available || 0;
  const splashesTotal = stats?.splashes?.total || 0;
  const splashesProgress = splashesTotal > 0 ? (splashesUsed / splashesTotal) * 100 : 0;
  
  const opportunitiesUsed = stats?.dailyOpportunities?.used || 0;
  const opportunitiesTotal = stats?.dailyOpportunities?.total || 0;
  const opportunitiesProgress = opportunitiesTotal > 0 ? (opportunitiesUsed / opportunitiesTotal) * 100 : 0;

  return (
    <Layout 
      title="Billing & Add-ons" 
      subtitle="Manage your subscription, splashes, and daily opportunities"
    >

      <Tabs defaultValue="subscription" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="add-ons">Add-ons</TabsTrigger>
          <TabsTrigger value="payment-history">Payment History</TabsTrigger>
        </TabsList>
        
        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 subscription-plans">
            {/* Current Plan */}
            <Card className={cn(
              "col-span-1 md:col-span-1 relative overflow-hidden border-2",
              currentPlan.isPopular ? "border-primary" : "border-border"
            )}>
              {currentPlan.isPopular && (
                <div className="absolute top-0 right-0 bg-primary text-white px-3 py-1 text-xs font-medium">
                  Popular
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex justify-between items-start">
                  <div>
                    <span>{currentPlan.name}</span>
                    <Badge variant="outline" className="ml-2 bg-primary-50 text-primary-700">Current</Badge>
                  </div>
                  <span className="text-xl">{currentPlan.price}<span className="text-sm text-muted-foreground">/mo</span></span>
                </CardTitle>
                <CardDescription>{currentPlan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {currentPlan.features.map((feature, index) => (
                    <div key={index} className="flex items-center">
                      <Check className="mr-2 h-4 w-4 text-primary" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" disabled>Current Plan</Button>
              </CardFooter>
            </Card>

            {/* Other Plans */}
            {plans
              .filter(plan => plan.name.toLowerCase() !== userSubscription.toLowerCase())
              .map((plan) => (
                <Card 
                  key={plan.id} 
                  className={cn(
                    "col-span-1 md:col-span-1 relative overflow-hidden border-2",
                    plan.isPopular ? "border-primary" : "border-border"
                  )}
                >
                  {plan.isPopular && (
                    <div className="absolute top-0 right-0 bg-primary text-white px-3 py-1 text-xs font-medium">
                      Popular
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="flex justify-between items-start">
                      <span>{plan.name}</span>
                      <span className="text-xl">{plan.price}<span className="text-sm text-muted-foreground">/mo</span></span>
                    </CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-center">
                          <Check className="mr-2 h-4 w-4 text-primary" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full" 
                      onClick={() => {
                        setSelectedPlan(plan.name);
                        setIsUpgradeDialogOpen(true);
                      }}
                    >
                      Upgrade
                    </Button>
                  </CardFooter>
                </Card>
              ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Subscription Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-medium">Current Plan: <span className="text-primary-600">{currentPlan.name}</span></h3>
                    <p className="text-gray-500">
                      {isLoadingBillingInfo ? (
                        <span className="text-sm">Loading subscription details...</span>
                      ) : (
                        <span className="text-sm flex items-center">
                          <Calendar className="mr-1 h-4 w-4" />
                          Renews on {billingInfo?.nextBillingDate || 'N/A'}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Change Payment Method
                    </Button>
                    <Button variant="destructive">Cancel Subscription</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Add-ons Tab */}
        <TabsContent value="add-ons">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Splashes Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center">
                  <Sparkles className="mr-2 h-5 w-5 text-primary" />
                  Premium Splashes
                </CardTitle>
                <CardDescription>
                  Premium Splashes give you instant access to high-quality backlink opportunities (DA 40+, relevance 80%+, spam &lt;2%)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between mb-1 text-sm">
                      <span>Premium Splashes Used: {splashesUsed} / {splashesTotal}</span>
                      <span>{stats?.splashes?.available || 0} remaining</span>
                    </div>
                    <Progress value={splashesProgress} className="h-2" />
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium mb-2">Get Premium Splashes</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Need an instant boost in quality? Purchase Premium Splashes to get higher quality backlink opportunities instantly. Each Premium Splash delivers 1 top-tier opportunity (DA 40+, relevance 80%+, spam score &lt;2%).
                    </p>
                    <Button onClick={() => setIsPremiumSplashesDialogOpen(true)}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Buy Premium Splashes
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Drips Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center">
                  <Package2 className="mr-2 h-5 w-5 text-primary" />
                  Daily Opportunities
                </CardTitle>
                <CardDescription>
                  Monitor your daily opportunity allocation and usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between mb-1 text-sm">
                      <span>Daily Opportunities Used: {opportunitiesUsed} / {opportunitiesTotal}</span>
                      <span>{opportunitiesTotal - opportunitiesUsed} remaining</span>
                    </div>
                    <Progress value={opportunitiesProgress} className="h-2" />
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium mb-2">Increase Your Daily Opportunities</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Want more daily opportunities? Upgrade your subscription plan to increase your daily allocation. Each tier provides more opportunities tailored to your websites.
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        // Simple approach - just click the subscription tab
                        const subscriptionTab = document.querySelector('[value="subscription"]');
                        if (subscriptionTab instanceof HTMLElement) {
                          subscriptionTab.click();
                        }
                        
                        // Scroll to the subscription section
                        setTimeout(() => {
                          document.querySelector('.subscription-plans')?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }}
                    >
                      <ChevronRight className="mr-2 h-4 w-4" />
                      View Subscription Plans
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Add-on Usage History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase text-gray-500 bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3">Date</th>
                      <th scope="col" className="px-6 py-3">Type</th>
                      <th scope="col" className="px-6 py-3">Description</th>
                      <th scope="col" className="px-6 py-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Sample data - would be replaced with actual usage history */}
                    <tr className="bg-white border-b">
                      <td className="px-6 py-4">May 10, 2025</td>
                      <td className="px-6 py-4">Premium Splash</td>
                      <td className="px-6 py-4">Used for high-quality opportunities</td>
                      <td className="px-6 py-4">1</td>
                    </tr>
                    <tr className="bg-white border-b">
                      <td className="px-6 py-4">May 8, 2025</td>
                      <td className="px-6 py-4">Premium Splash</td>
                      <td className="px-6 py-4">Used for high-quality opportunities</td>
                      <td className="px-6 py-4">1</td>
                    </tr>
                    <tr className="bg-white border-b">
                      <td className="px-6 py-4">May 3, 2025</td>
                      <td className="px-6 py-4">Premium Splash</td>
                      <td className="px-6 py-4">Monthly allocation</td>
                      <td className="px-6 py-4">3</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Payment History Tab */}
        <TabsContent value="payment-history">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase text-gray-500 bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3">Date</th>
                      <th scope="col" className="px-6 py-3">Description</th>
                      <th scope="col" className="px-6 py-3">Amount</th>
                      <th scope="col" className="px-6 py-3">Status</th>
                      <th scope="col" className="px-6 py-3">Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Sample data - would be replaced with actual payment history */}
                    <tr className="bg-white border-b">
                      <td className="px-6 py-4">May 1, 2025</td>
                      <td className="px-6 py-4">Monthly Subscription - {userSubscription}</td>
                      <td className="px-6 py-4">{currentPlan.price}</td>
                      <td className="px-6 py-4">
                        <Badge variant="success">Paid</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Button variant="link" className="p-0 h-auto">View</Button>
                      </td>
                    </tr>
                    <tr className="bg-white border-b">
                      <td className="px-6 py-4">Apr 1, 2025</td>
                      <td className="px-6 py-4">Monthly Subscription - {userSubscription}</td>
                      <td className="px-6 py-4">{currentPlan.price}</td>
                      <td className="px-6 py-4">
                        <Badge variant="success">Paid</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Button variant="link" className="p-0 h-auto">View</Button>
                      </td>
                    </tr>
                    <tr className="bg-white border-b">
                      <td className="px-6 py-4">Apr 15, 2025</td>
                      <td className="px-6 py-4">Premium Splashes - 3 Pack</td>
                      <td className="px-6 py-4">$18.00</td>
                      <td className="px-6 py-4">
                        <Badge variant="success">Paid</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Button variant="link" className="p-0 h-auto">View</Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Upgrade Dialog */}
      <Dialog open={isUpgradeDialogOpen} onOpenChange={setIsUpgradeDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Upgrade Subscription</DialogTitle>
            <DialogDescription>
              You're upgrading from {currentPlan.name} to {selectedPlan}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Your new plan will be active immediately after upgrading. You'll be billed the prorated amount for the remainder of your current billing cycle.
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium mb-2">Plan Features</h4>
              <div className="space-y-2">
                {plans.find(plan => plan.name === selectedPlan)?.features.map((feature, index) => (
                  <div key={index} className="flex items-center">
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>New Plan</span>
                <span>{plans.find(plan => plan.name === selectedPlan)?.price}/month</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Current Plan</span>
                <span>{currentPlan.price}/month</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-medium">
                <span>New Monthly Payment</span>
                <span>{plans.find(plan => plan.name === selectedPlan)?.price}/month</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpgradeDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpgradeSubscription}
              disabled={updateSubscriptionMutation.isPending}
            >
              {updateSubscriptionMutation.isPending ? "Processing..." : "Confirm Upgrade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Buy Premium Splashes Dialog */}
      <BuySplashesDialog 
        open={isPremiumSplashesDialogOpen}
        onOpenChange={setIsPremiumSplashesDialogOpen}
        onClose={() => setIsPremiumSplashesDialogOpen(false)}
      />
    </Layout>
  );
}