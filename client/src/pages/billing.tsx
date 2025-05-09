import Layout from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
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

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string>(user?.subscription || 'Free Trial');
  const [selectedCredits, setSelectedCredits] = useState<string>("50");
  const [selectedDrips, setSelectedDrips] = useState<string>("10");
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);
  const [isAddCreditsDialogOpen, setIsAddCreditsDialogOpen] = useState(false);
  const [isAddDripsDialogOpen, setIsAddDripsDialogOpen] = useState(false);
  
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

  // Add credits mutation
  const addCreditsMutation = useMutation({
    mutationFn: async (credits: string) => {
      const res = await apiRequest("POST", "/api/credits/add", { credits: parseInt(credits) });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setIsAddCreditsDialogOpen(false);
      toast({
        title: "Credits added",
        description: `${selectedCredits} credits have been added to your account.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add credits",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add drips (opportunities) mutation
  const addDripsMutation = useMutation({
    mutationFn: async (drips: string) => {
      const res = await apiRequest("POST", "/api/drips/add", { drips: parseInt(drips) });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setIsAddDripsDialogOpen(false);
      toast({
        title: "Opportunities added",
        description: `${selectedDrips} additional daily opportunities have been added to your account.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add opportunities",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpgradeSubscription = () => {
    updateSubscriptionMutation.mutate(selectedPlan);
  };

  const handleAddCredits = () => {
    addCreditsMutation.mutate(selectedCredits);
  };

  const handleAddDrips = () => {
    addDripsMutation.mutate(selectedDrips);
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
        "5 opportunities per day",
        "10 credits total",
        "Basic AI features",
        "Standard support",
      ],
      limits: {
        websites: 1,
        opportunities: 5,
        credits: 10,
      },
    },
    {
      id: "starter",
      name: "Starter",
      description: "Perfect for individual bloggers and small websites",
      price: "$39",
      features: [
        "1 website",
        "10 opportunities per day",
        "50 credits per month",
        "Basic AI features",
        "Standard support",
      ],
      limits: {
        websites: 1,
        opportunities: 10,
        credits: 50,
      },
    },
    {
      id: "grow",
      name: "Grow",
      description: "Ideal for growing websites and small agencies",
      price: "$69",
      features: [
        "2 websites",
        "20 opportunities per day",
        "150 credits per month",
        "1 competitor tracking",
        "Advanced AI email templates",
        "Priority support",
      ],
      limits: {
        websites: 2,
        opportunities: 20,
        credits: 150,
      },
      isPopular: true,
    },
    {
      id: "pro",
      name: "Pro",
      description: "For agencies and multiple website owners",
      price: "$129",
      features: [
        "5 websites",
        "30 opportunities per day",
        "300 credits per month",
        "3 competitor tracking",
        "Premium AI features",
        "Priority support with dedicated account manager",
      ],
      limits: {
        websites: 5,
        opportunities: 30,
        credits: 300,
      },
    },
  ];

  // Current plan object - case insensitive match
  const userSubscription = user?.subscription || 'Free Trial';
  const currentPlan = plans.find(plan => 
    plan.name.toLowerCase() === userSubscription.toLowerCase()
  ) || plans[0];

  // Credit packages
  const creditPackages = [
    { value: "50", label: "50 Credits", price: "$19" },
    { value: "100", label: "100 Credits", price: "$29" },
    { value: "200", label: "200 Credits", price: "$49" },
    { value: "500", label: "500 Credits", price: "$99" },
  ];

  // Drip (opportunity) packages
  const dripPackages = [
    { value: "10", label: "10 Daily Opportunities", price: "$15/month" },
    { value: "25", label: "25 Daily Opportunities", price: "$30/month" },
    { value: "50", label: "50 Daily Opportunities", price: "$50/month" },
  ];

  // Calculate progress
  const creditsUsed = stats?.credits?.total - stats?.credits?.available || 0;
  const creditsTotal = stats?.credits?.total || 0;
  const creditsProgress = creditsTotal > 0 ? (creditsUsed / creditsTotal) * 100 : 0;
  
  const opportunitiesUsed = stats?.dailyOpportunities?.used || 0;
  const opportunitiesTotal = stats?.dailyOpportunities?.total || 0;
  const opportunitiesProgress = opportunitiesTotal > 0 ? (opportunitiesUsed / opportunitiesTotal) * 100 : 0;

  return (
    <Layout title="Billing & Add-ons">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Add-ons</h1>
          <p className="text-muted-foreground">
            Manage your subscription, credits, and daily opportunities
          </p>
        </div>
      </div>

      <Tabs defaultValue="subscription" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="add-ons">Add-ons</TabsTrigger>
          <TabsTrigger value="payment-history">Payment History</TabsTrigger>
        </TabsList>
        
        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
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
              .filter(plan => plan.name.toLowerCase() !== (user?.subscription || '').toLowerCase())
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
            {/* Credits Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center">
                  <CreditCard className="mr-2 h-5 w-5 text-primary" />
                  Credits
                </CardTitle>
                <CardDescription>
                  Credits are used to unlock prospect information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between mb-1 text-sm">
                      <span>Credits Used: {creditsUsed} / {creditsTotal}</span>
                      <span>{stats?.credits?.available || 0} remaining</span>
                    </div>
                    <Progress value={creditsProgress} className="h-2" />
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium mb-2">Get Additional Credits</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Need more credits? Purchase additional credits that never expire.
                    </p>
                    <Button onClick={() => setIsAddCreditsDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Buy Credits
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Daily Opportunities Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center">
                  <Droplets className="mr-2 h-5 w-5 text-primary" />
                  Daily Opportunities (Drips)
                </CardTitle>
                <CardDescription>
                  Get more opportunities for your backlink outreach
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between mb-1 text-sm">
                      <span>Today's Usage: {opportunitiesUsed} / {opportunitiesTotal}</span>
                      <span>{opportunitiesTotal - opportunitiesUsed} remaining</span>
                    </div>
                    <Progress value={opportunitiesProgress} className="h-2" />
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium mb-2">Get more opportunities (One-time)</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Purchase additional opportunities to find quality backlink prospects.
                    </p>
                    <Button onClick={() => setIsAddDripsDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Opportunities
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Feature Card */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Features</CardTitle>
              <CardDescription>
                Enhance your backlink prospecting with additional features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Competitor Tracking */}
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg">Competitor Tracking</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-sm text-gray-600 mb-3">
                      Track your competitors' backlinks and get insights for your own strategy.
                    </p>
                    {user?.subscription === 'Pro' ? (
                      <div className="text-sm text-primary-600">
                        3 competitors included in your Pro plan
                      </div>
                    ) : user?.subscription === 'Grow' ? (
                      <div className="text-sm text-primary-600">
                        1 competitor included in your Grow plan
                      </div>
                    ) : (
                      <Button className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Upgrade for Access
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Advanced AI Templates */}
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg">Advanced AI Templates</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-sm text-gray-600 mb-3">
                      Access premium AI-powered email templates for higher response rates.
                    </p>
                    {user?.subscription === 'Pro' || user?.subscription === 'Grow' ? (
                      <div className="text-sm text-primary-600">
                        Included in your {user?.subscription} plan
                      </div>
                    ) : (
                      <Button className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Upgrade for Access
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Priority Support */}
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg">Priority Support</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-sm text-gray-600 mb-3">
                      Get priority support with a dedicated account manager.
                    </p>
                    {user?.subscription === 'Pro' ? (
                      <div className="text-sm text-primary-600">
                        Included in your Pro plan
                      </div>
                    ) : (
                      <Button className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Upgrade for Access
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Payment History Tab */}
        <TabsContent value="payment-history">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>
                View your recent payments and invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingBillingInfo ? (
                <div className="py-10 text-center">
                  <div className="inline-block animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mb-2"></div>
                  <p>Loading payment history...</p>
                </div>
              ) : billingInfo?.payments?.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {/* Sample payment history items - would be replaced with actual data */}
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">May 1, 2025</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Pro Monthly Subscription</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">$129.00</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant="outline" className="bg-green-50 text-green-700">Paid</Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <Button variant="ghost" size="sm" className="h-8 text-primary-600">
                            Download
                          </Button>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Apr 15, 2025</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">100 Credits Purchase</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">$29.00</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant="outline" className="bg-green-50 text-green-700">Paid</Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <Button variant="ghost" size="sm" className="h-8 text-primary-600">
                            Download
                          </Button>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Apr 1, 2025</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Pro Monthly Subscription</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">$129.00</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant="outline" className="bg-green-50 text-green-700">Paid</Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <Button variant="ghost" size="sm" className="h-8 text-primary-600">
                            Download
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                    <DollarSign className="h-6 w-6 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No payment history</h3>
                  <p className="text-gray-500 mb-4">
                    You don't have any payment history yet. Your invoices will appear here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upgrade Subscription Dialog */}
      <Dialog open={isUpgradeDialogOpen} onOpenChange={setIsUpgradeDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upgrade to {selectedPlan}</DialogTitle>
            <DialogDescription>
              Confirm your subscription upgrade to start accessing more features.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex justify-between mb-2">
                <span className="font-medium">{selectedPlan} Plan</span>
                <span className="font-medium">
                  {plans.find(p => p.name === selectedPlan)?.price || '$0'}/month
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {plans.find(p => p.name === selectedPlan)?.description || ''}
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="text-sm font-medium">You'll get access to:</h4>
              {plans.find(p => p.name === selectedPlan)?.features.map((feature, index) => (
                <div key={index} className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-primary" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
            
            <Separator className="my-6" />
            
            <div className="bg-yellow-50 border border-yellow-100 rounded-md p-4 text-yellow-800 text-sm flex items-start mb-6">
              <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                Your current plan will be upgraded immediately. You will be charged the prorated amount for the remainder of your billing cycle.
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsUpgradeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleUpgradeSubscription}
              disabled={updateSubscriptionMutation.isPending}
            >
              {updateSubscriptionMutation.isPending && (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
              )}
              Confirm Upgrade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Credits Dialog */}
      <Dialog open={isAddCreditsDialogOpen} onOpenChange={setIsAddCreditsDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Purchase Additional Credits</DialogTitle>
            <DialogDescription>
              Credits are used to unlock prospect information. These credits never expire.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="space-y-4">
              <Label>Select Credit Package</Label>
              <div className="grid grid-cols-1 gap-3">
                {creditPackages.map((pkg) => (
                  <div 
                    key={pkg.value}
                    className={cn(
                      "border rounded-lg p-4 cursor-pointer transition-colors",
                      selectedCredits === pkg.value 
                        ? "border-primary bg-primary-50" 
                        : "border-border hover:border-primary/50"
                    )}
                    onClick={() => setSelectedCredits(pkg.value)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={cn(
                          "w-5 h-5 rounded-full border flex items-center justify-center mr-3",
                          selectedCredits === pkg.value 
                            ? "border-primary bg-primary text-white" 
                            : "border-gray-300"
                        )}>
                          {selectedCredits === pkg.value && <Check className="h-3 w-3" />}
                        </div>
                        <div>
                          <div className="font-medium">{pkg.label}</div>
                          <div className="text-sm text-gray-500">One-time purchase</div>
                        </div>
                      </div>
                      <div className="font-medium">{pkg.price}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsAddCreditsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleAddCredits}
              disabled={addCreditsMutation.isPending}
            >
              {addCreditsMutation.isPending && (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
              )}
              Purchase Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Drips Dialog */}
      <Dialog open={isAddDripsDialogOpen} onOpenChange={setIsAddDripsDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Add Daily Opportunities</DialogTitle>
            <DialogDescription>
              Increase your daily opportunity limit with add-on packages.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="space-y-4">
              <Label>Select Opportunities Package</Label>
              <div className="grid grid-cols-1 gap-3">
                {dripPackages.map((pkg) => (
                  <div 
                    key={pkg.value}
                    className={cn(
                      "border rounded-lg p-4 cursor-pointer transition-colors",
                      selectedDrips === pkg.value 
                        ? "border-primary bg-primary-50" 
                        : "border-border hover:border-primary/50"
                    )}
                    onClick={() => setSelectedDrips(pkg.value)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={cn(
                          "w-5 h-5 rounded-full border flex items-center justify-center mr-3",
                          selectedDrips === pkg.value 
                            ? "border-primary bg-primary text-white" 
                            : "border-gray-300"
                        )}>
                          {selectedDrips === pkg.value && <Check className="h-3 w-3" />}
                        </div>
                        <div>
                          <div className="font-medium">{pkg.label}</div>
                          <div className="text-sm text-gray-500">Additional daily limit</div>
                        </div>
                      </div>
                      <div className="font-medium">{pkg.price}</div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="bg-yellow-50 border border-yellow-100 rounded-md p-4 text-yellow-800 text-sm flex items-start mt-4">
                <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  This is a recurring monthly charge that will be added to your subscription. Your daily opportunity limit will be immediately increased.
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsAddDripsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleAddDrips}
              disabled={addDripsMutation.isPending}
            >
              {addDripsMutation.isPending && (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
              )}
              Add Opportunities
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

// For small icon within button (Plus)
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