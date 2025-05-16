import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SubscriptionCard } from '@/components/subscription-card';
import { SubscriptionPlan } from '@/lib/subscription-plans';
import SplashDialog from '@/components/splash-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Calendar, CreditCard, LucideIcon, Package, RefreshCw, Settings, User } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';

interface UserStats {
  remainingSplashes: number;
  maxSplashesPerMonth: number;
  hasActiveSubscription: boolean;
  maxWebsites: number;
  websites: any[];
}

interface SubscriptionResponse {
  subscription?: {
    isActive: boolean;
    plan: string;
    renewsAt?: string;
    status?: string;
    variant?: string;
    cancelUrl?: string;
  };
}

const AccountSummary = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpenSplashDialog, setIsOpenSplashDialog] = useState(false);

  const { data: stats, isLoading, refetch } = useQuery<UserStats>({
    queryKey: ['/api/subscription/user-stats'],
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleAddSplashes = () => {
    setIsOpenSplashDialog(true);
  };

  const handleDialogClose = (purchased: boolean) => {
    setIsOpenSplashDialog(false);
    if (purchased) {
      toast({
        title: 'Purchase Successful',
        description: 'Your Splash credits have been added to your account.',
      });
      refetch();
    }
  };

  // Get subscription details
  const { data: subscription } = useQuery<SubscriptionResponse>({
    queryKey: ['/api/subscription/subscription'],
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // If user has no subscription, it will be undefined or { isActive: false }
  const isSubscribed = subscription?.subscription?.isActive || false;
  const plan = subscription?.subscription?.plan || 'Free Trial';
  const renewsAt = subscription?.subscription?.renewsAt ? 
    new Date(subscription.subscription.renewsAt) : null;
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-xl bg-primary/10 text-primary-800">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold">{user?.firstName} {user?.lastName}</h2>
            <p className="text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Badge 
          variant={isSubscribed ? "default" : "outline"}
          className={isSubscribed ? "bg-green-600 hover:bg-green-700" : ""}
        >
          {isSubscribed ? `${plan} Plan` : 'Free Trial'}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plan}</div>
            {renewsAt && (
              <p className="text-xs text-muted-foreground">
                Renews on {format(renewsAt, 'MMMM dd, yyyy')}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" className="w-full">
              <CreditCard className="mr-2 h-4 w-4" />
              Manage Subscription
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Splash Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : stats?.remainingSplashes || 0} 
              <span className="text-sm text-muted-foreground font-normal">
                / {isLoading ? "..." : stats?.maxSplashesPerMonth || 0} per month
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Reset on the 1st of each month
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" className="w-full" onClick={handleAddSplashes}>
              <Package className="mr-2 h-4 w-4" />
              Buy More Splashes
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Websites</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : stats?.websites?.length || 0}
              <span className="text-sm text-muted-foreground font-normal">
                / {isLoading ? "..." : stats?.maxWebsites || 1} allowed
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Loading..." : stats?.websites?.map(w => w.domain).join(", ")}
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <a href="/websites">
                <Settings className="mr-2 h-4 w-4" />
                Manage Websites
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <SplashDialog 
        open={isOpenSplashDialog} 
        onOpenChange={handleDialogClose} 
      />
    </div>
  );
};

const SubscriptionTab = () => {
  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
      <SubscriptionCard 
        plan={SubscriptionPlan.STARTER}
        price={9}
        features={[
          "5 drips/day",
          "1 Splash/month",
          "1 website",
          "Basic filters"
        ]}
      />
      <SubscriptionCard 
        plan={SubscriptionPlan.GROW}
        price={19}
        features={[
          "10 drips/day",
          "3 Splashes/month",
          "2 websites",
          "Advanced filters"
        ]}
        popular={true}
      />
      <SubscriptionCard 
        plan={SubscriptionPlan.PRO}
        price={39}
        features={[
          "15 drips/day",
          "7 Splashes/month",
          "5 websites",
          "Full filters"
        ]}
      />
    </div>
  );
};

interface AccountTabProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const AccountTab = ({ icon: Icon, title, description }: AccountTabProps) => {
  return (
    <div className="flex items-center gap-4">
      <div className="p-2 rounded-full bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
};

import DashboardLayout from '@/components/dashboard-layout';

export default function AccountPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <Helmet>
        <title>Account | LinkDripAI</title>
        <meta name="description" content="Manage your LinkDripAI account, subscription, and Splash credits" />
      </Helmet>
      
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Account</h1>
          <p className="text-muted-foreground">
            Manage your account settings, subscription, and Splash credits
          </p>
        </div>

        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="settings">Account Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary">
            <AccountSummary />
          </TabsContent>
          
          <TabsContent value="subscription">
            <SubscriptionTab />
          </TabsContent>
          
          <TabsContent value="settings">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Account Settings</h3>
                <p className="text-sm text-muted-foreground">Update your account information and preferences.</p>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <AccountTab 
                  icon={User}
                  title="Personal Information"
                  description="Update your name, email, and other personal details"
                />
                
                <AccountTab 
                  icon={CreditCard}
                  title="Billing Information"
                  description="Update your payment methods and billing address"
                />
                
                <AccountTab 
                  icon={RefreshCw}
                  title="Usage History"
                  description="View your usage history and past invoices"
                />
                
                <AccountTab 
                  icon={Calendar}
                  title="Subscription History"
                  description="View your subscription plans and payment history"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}