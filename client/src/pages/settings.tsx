import React, { useState } from 'react';
import { Layout } from '@/components/layout';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle, 
  CardFooter
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { 
  Switch
} from '@/components/ui/switch';
import { 
  Separator
} from '@/components/ui/separator';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { 
  User, 
  KeyRound, 
  Bell, 
  Shield, 
  Clock, 
  Mail, 
  HardDrive, 
  Trash2, 
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

// Form schemas
const profileFormSchema = z.object({
  username: z.string().min(3, {
    message: "Username must be at least 3 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  name: z.string().optional(),
  company: z.string().optional(),
});

const notificationsFormSchema = z.object({
  emailNotifications: z.boolean(),
  emailDigest: z.boolean(),
  newOpportunities: z.boolean(),
  backlinksSecured: z.boolean(),
  productUpdates: z.boolean(),
});

const appearanceFormSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  language: z.string(),
  timezone: z.string(),
  dashboardView: z.enum(["cards", "list"]),
});

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  
  // Profile form
  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      name: user?.name || "",
      company: user?.company || "",
    },
  });
  
  // Notifications form
  const notificationsForm = useForm<z.infer<typeof notificationsFormSchema>>({
    resolver: zodResolver(notificationsFormSchema),
    defaultValues: {
      emailNotifications: true,
      emailDigest: true,
      newOpportunities: true,
      backlinksSecured: true,
      productUpdates: true,
    },
  });
  
  // Appearance form
  const appearanceForm = useForm<z.infer<typeof appearanceFormSchema>>({
    resolver: zodResolver(appearanceFormSchema),
    defaultValues: {
      theme: "system",
      language: "english",
      timezone: "utc",
      dashboardView: "cards",
    },
  });
  
  // Submit handlers
  function onProfileSubmit(data: z.infer<typeof profileFormSchema>) {
    setIsUpdating(true);
    // Simulate API call
    setTimeout(() => {
      setIsUpdating(false);
      toast({
        title: "Profile updated",
        description: "Your profile information has been updated successfully.",
      });
    }, 1000);
  }
  
  function onNotificationsSubmit(data: z.infer<typeof notificationsFormSchema>) {
    setIsUpdating(true);
    // Simulate API call
    setTimeout(() => {
      setIsUpdating(false);
      toast({
        title: "Notification preferences updated",
        description: "Your notification settings have been saved.",
      });
    }, 1000);
  }
  
  function onAppearanceSubmit(data: z.infer<typeof appearanceFormSchema>) {
    setIsUpdating(true);
    // Simulate API call
    setTimeout(() => {
      setIsUpdating(false);
      toast({
        title: "Appearance settings updated",
        description: "Your appearance preferences have been saved.",
      });
    }, 1000);
  }
  
  function onDeactivateAccount() {
    setIsDeactivating(true);
    // Simulate API call
    setTimeout(() => {
      setIsDeactivating(false);
      toast({
        title: "Account deactivation requested",
        description: "We've sent you an email to confirm your account deactivation.",
        variant: "destructive",
      });
    }, 1500);
  }

  return (
    <Layout title="Settings">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account preferences and application settings
          </p>
        </div>
      </div>
      
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        
        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Update your personal information and profile settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FormField
                      control={profileForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="username" {...field} />
                          </FormControl>
                          <FormDescription>
                            Your unique username for the platform.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="email@example.com" {...field} />
                          </FormControl>
                          <FormDescription>
                            Your primary email address.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FormField
                      control={profileForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormDescription>
                            Your full name (optional).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company</FormLabel>
                          <FormControl>
                            <Input placeholder="Company name" {...field} />
                          </FormControl>
                          <FormDescription>
                            Your company or organization (optional).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isUpdating ? "Saving changes..." : "Save changes"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Customize when and how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...notificationsForm}>
                <form onSubmit={notificationsForm.handleSubmit(onNotificationsSubmit)} className="space-y-6">
                  <FormField
                    control={notificationsForm.control}
                    name="emailNotifications"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Email Notifications</FormLabel>
                          <FormDescription>
                            Receive notifications via email
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={notificationsForm.control}
                    name="emailDigest"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Weekly Digest</FormLabel>
                          <FormDescription>
                            Receive a weekly summary of your account activity
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <div className="space-y-3">
                    <h3 className="text-lg font-medium">Activity Notifications</h3>
                    <Separator />
                    
                    <FormField
                      control={notificationsForm.control}
                      name="newOpportunities"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 mt-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">New Opportunities</FormLabel>
                            <FormDescription>
                              Get notified when new backlink opportunities are available
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={notificationsForm.control}
                      name="backlinksSecured"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Backlinks Secured</FormLabel>
                            <FormDescription>
                              Get notified when your backlinks are successfully secured
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={notificationsForm.control}
                      name="productUpdates"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Product Updates</FormLabel>
                            <FormDescription>
                              Stay informed about new features and improvements
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isUpdating ? "Saving preferences..." : "Save preferences"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>
                Customize how LinkDripAI looks and functions for you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...appearanceForm}>
                <form onSubmit={appearanceForm.handleSubmit(onAppearanceSubmit)} className="space-y-6">
                  <FormField
                    control={appearanceForm.control}
                    name="theme"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Theme</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a theme" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark</SelectItem>
                            <SelectItem value="system">System</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose how the application appears to you.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={appearanceForm.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Language</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a language" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="english">English</SelectItem>
                            <SelectItem value="spanish">Spanish</SelectItem>
                            <SelectItem value="french">French</SelectItem>
                            <SelectItem value="german">German</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose your preferred language for the application.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={appearanceForm.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timezone</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a timezone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="utc">UTC (Coordinated Universal Time)</SelectItem>
                            <SelectItem value="est">EST (Eastern Standard Time)</SelectItem>
                            <SelectItem value="cst">CST (Central Standard Time)</SelectItem>
                            <SelectItem value="mst">MST (Mountain Standard Time)</SelectItem>
                            <SelectItem value="pst">PST (Pacific Standard Time)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose your timezone for accurate reporting and scheduling.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={appearanceForm.control}
                    name="dashboardView"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Dashboard View</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a view" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cards">Card View</SelectItem>
                            <SelectItem value="list">List View</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose your preferred view style for opportunities.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isUpdating ? "Saving settings..." : "Save settings"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Security Tab */}
        <TabsContent value="security">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <KeyRound className="h-5 w-5 mr-2" />
                  Password
                </CardTitle>
                <CardDescription>
                  Update your password and manage account security settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <FormLabel>Current Password</FormLabel>
                    <Input type="password" />
                  </div>
                  <div>
                    <FormLabel>New Password</FormLabel>
                    <Input type="password" />
                  </div>
                  <div>
                    <FormLabel>Confirm New Password</FormLabel>
                    <Input type="password" />
                  </div>
                  <Button>Update Password</Button>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Two-Factor Authentication
                </CardTitle>
                <CardDescription>
                  Add an additional layer of security to your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Two-Factor Authentication</p>
                      <p className="text-sm text-muted-foreground">Secure your account with 2FA</p>
                    </div>
                    <Switch />
                  </div>
                  <Button variant="outline">Setup 2FA</Button>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Session Management
                </CardTitle>
                <CardDescription>
                  Manage your active sessions and devices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-md border">
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">Current Session</p>
                        <p className="text-sm text-muted-foreground">Chrome on Windows • Active now</p>
                      </div>
                      <Badge>Current</Badge>
                    </div>
                    <Separator />
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">Mobile App</p>
                        <p className="text-sm text-muted-foreground">iOS • Last active 2 days ago</p>
                      </div>
                      <Button variant="ghost" size="sm">Revoke</Button>
                    </div>
                  </div>
                  <Button variant="outline">Log Out All Devices</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Advanced Tab */}
        <TabsContent value="advanced">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <HardDrive className="h-5 w-5 mr-2" />
                  Data Export
                </CardTitle>
                <CardDescription>
                  Export all your data from LinkDripAI
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    You can export all your data, including opportunities, emails, and analytics in various formats.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline">Export as CSV</Button>
                    <Button variant="outline">Export as JSON</Button>
                    <Button variant="outline">Export as PDF</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-destructive">
                  <Trash2 className="h-5 w-5 mr-2" />
                  Account Deactivation
                </CardTitle>
                <CardDescription>
                  Temporarily or permanently deactivate your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border border-destructive/20 rounded-md p-4 bg-destructive/5 mb-4">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-destructive mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Warning</p>
                      <p className="text-sm text-muted-foreground">
                        Deactivating your account will make your profile and data inaccessible.
                        If you deactivate your account, you can reactivate it at any time by logging in again.
                      </p>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="destructive" 
                  disabled={isDeactivating}
                  onClick={onDeactivateAccount}
                >
                  {isDeactivating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isDeactivating ? "Processing..." : "Deactivate Account"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}

// Helper Badge component
function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-800 ${className}`}>
      {children}
    </span>
  );
}