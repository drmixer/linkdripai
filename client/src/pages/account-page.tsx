import { useEffect, useState } from "react";
import Layout from "@/components/layout";
import { SubscriptionCard } from "@/components/subscription-card";
import { BuySplashesDialog } from "@/components/buy-splashes-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { User, CreditCard, Bell, Info, Sparkles, UsersRound, HardDrive } from "lucide-react";

export default function AccountPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("subscription");
  const [showBuySplashesDialog, setShowBuySplashesDialog] = useState(false);

  // Fetch user stats
  const { data: userStats } = useQuery({
    queryKey: ["/api/user-stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/user-stats");
      return await response.json();
    },
  });

  const remainingSplashes = userStats?.remainingSplashes || 0;
  const websiteCount = userStats?.websites?.length || 0;
  const maxWebsites = userStats?.maxWebsites || 1;

  return (
    <Layout title="Account" subtitle="Manage your subscription and account settings">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 lg:grid-cols-5 h-auto gap-2">
          <TabsTrigger value="subscription" className="flex items-center gap-2 py-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Subscription</span>
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2 py-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="websites" className="flex items-center gap-2 py-2">
            <HardDrive className="h-4 w-4" />
            <span className="hidden sm:inline">Websites</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2 py-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="about" className="flex items-center gap-2 py-2">
            <Info className="h-4 w-4" />
            <span className="hidden sm:inline">About</span>
          </TabsTrigger>
        </TabsList>

        {/* Subscription Tab */}
        <TabsContent value="subscription" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <SubscriptionCard />
            </div>
            
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Splash Credits
                  </CardTitle>
                  <CardDescription>
                    Get high-quality backlink opportunities with DA 40+ instantly
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center justify-center p-4 bg-primary/5 rounded-lg">
                    <div className="text-4xl font-bold text-primary">{remainingSplashes}</div>
                    <div className="text-sm text-muted-foreground">Splashes Remaining</div>
                  </div>
                  
                  <Button 
                    onClick={() => setShowBuySplashesDialog(true)}
                    variant="premium"
                    className="w-full gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Buy Splashes
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UsersRound className="h-5 w-5 text-primary" />
                    Website Usage
                  </CardTitle>
                  <CardDescription>
                    Manage your website allocation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col items-center justify-center p-4 bg-primary/5 rounded-lg">
                    <div className="text-2xl font-bold">
                      {websiteCount} / {maxWebsites}
                    </div>
                    <div className="text-sm text-muted-foreground">Websites Used</div>
                  </div>
                  
                  {websiteCount >= maxWebsites && (
                    <div className="text-sm text-muted-foreground text-center">
                      To add more websites, upgrade your subscription plan.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Manage your personal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Full Name</h3>
                    <p className="mt-1">{user?.firstName} {user?.lastName}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Email</h3>
                    <p className="mt-1">{user?.email}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Username</h3>
                    <p className="mt-1">{user?.username}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Account Created</h3>
                    <p className="mt-1">
                      {user?.createdAt 
                        ? new Date(user.createdAt).toLocaleDateString() 
                        : "Not available"}
                    </p>
                  </div>
                </div>
                
                <div className="pt-4">
                  <Button variant="outline">Edit Profile</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Websites Tab */}
        <TabsContent value="websites">
          <Card>
            <CardHeader>
              <CardTitle>Website Management</CardTitle>
              <CardDescription>
                Manage your tracked websites
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {userStats?.websites && userStats.websites.length > 0 ? (
                <div className="space-y-4">
                  {userStats.websites.map((site: any) => (
                    <div key={site.id} className="flex items-center justify-between border-b pb-4">
                      <div>
                        <h3 className="font-medium">{site.name}</h3>
                        <p className="text-sm text-muted-foreground">{site.url}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">Edit</Button>
                        <Button variant="outline" size="sm" className="text-destructive">Delete</Button>
                      </div>
                    </div>
                  ))}
                  
                  {websiteCount < maxWebsites && (
                    <Button className="mt-4">Add Website</Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <h3 className="font-medium mb-2">No websites added yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add your first website to start receiving backlink opportunities
                  </p>
                  <Button>Add Website</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Manage how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center py-8 text-muted-foreground">
                Notification settings coming soon
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* About Tab */}
        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle>About LinkDripAI</CardTitle>
              <CardDescription>
                Learn about the platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium">Version</h3>
                <p className="text-sm text-muted-foreground">1.0.0</p>
              </div>
              
              <div>
                <h3 className="font-medium">Description</h3>
                <p className="text-sm text-muted-foreground">
                  LinkDripAI is an AI-powered backlink prospecting tool that automatically finds relevant 
                  link opportunities for your website. Our platform analyzes thousands of potential 
                  backlink sources and matches them to your site using advanced AI algorithms.
                </p>
              </div>
              
              <div>
                <h3 className="font-medium">Contact</h3>
                <p className="text-sm text-muted-foreground">
                  For support or questions, please email: support@linkdripai.com
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Buy Splashes Dialog */}
      <BuySplashesDialog
        open={showBuySplashesDialog}
        onOpenChange={setShowBuySplashesDialog}
      />
    </Layout>
  );
}