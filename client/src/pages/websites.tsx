import Layout from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Plus, Settings, Trash2, Copy, Check, ExternalLink } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

const websiteFormSchema = z.object({
  name: z.string().min(1, "Website name is required"),
  url: z
    .string()
    .min(1, "Website URL is required")
    .url("Please enter a valid URL")
    .or(z.string().regex(/^[a-zA-Z0-9][-a-zA-Z0-9]+\.[a-zA-Z0-9][-a-zA-Z0-9.]+$/, "Please enter a valid domain")),
  niche: z.string().min(1, "Website niche is required"),
});

type WebsiteFormValues = z.infer<typeof websiteFormSchema>;

export default function WebsitesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  const [isNewWebsiteDialogOpen, setIsNewWebsiteDialogOpen] = useState(false);
  const [selectedWebsite, setSelectedWebsite] = useState<any>(null);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Fetch websites
  const { data: websites, isLoading: isLoadingWebsites } = useQuery({
    queryKey: ["/api/websites"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/websites");
      return await res.json();
    },
  });

  // Form for adding a new website
  const form = useForm<WebsiteFormValues>({
    resolver: zodResolver(websiteFormSchema),
    defaultValues: {
      name: "",
      url: "",
      niche: "",
    },
  });

  // Add website mutation
  const addWebsiteMutation = useMutation({
    mutationFn: async (data: WebsiteFormValues) => {
      const res = await apiRequest("POST", "/api/websites", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/websites"] });
      setIsNewWebsiteDialogOpen(false);
      form.reset();
      toast({
        title: "Website added",
        description: "Your website has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add website",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update website mutation
  const updateWebsiteMutation = useMutation({
    mutationFn: async (data: WebsiteFormValues & { id: number }) => {
      const res = await apiRequest("PATCH", `/api/websites/${data.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/websites"] });
      setIsSettingsDialogOpen(false);
      toast({
        title: "Website updated",
        description: "Your website has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update website",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete website mutation
  const deleteWebsiteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/websites/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/websites"] });
      setIsDeleteDialogOpen(false);
      toast({
        title: "Website deleted",
        description: "Your website has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete website",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Settings form for updating website
  const settingsForm = useForm<WebsiteFormValues>({
    resolver: zodResolver(websiteFormSchema),
    defaultValues: {
      name: "",
      url: "",
      niche: "",
    },
  });

  const onSubmit = (data: WebsiteFormValues) => {
    addWebsiteMutation.mutate(data);
  };

  const onSettingsSubmit = (data: WebsiteFormValues) => {
    if (selectedWebsite) {
      updateWebsiteMutation.mutate({ ...data, id: selectedWebsite.id });
    }
  };

  const handleSettingsClick = (website: any) => {
    setSelectedWebsite(website);
    settingsForm.reset({
      name: website.name,
      url: website.url,
      niche: website.niche,
    });
    setIsSettingsDialogOpen(true);
  };

  const handleDeleteClick = (website: any) => {
    setSelectedWebsite(website);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedWebsite) {
      deleteWebsiteMutation.mutate(selectedWebsite.id);
    }
  };

  // Calculate websites limit based on the subscription plan
  const getPlanWebsiteLimit = (planName: string): number => {
    const limits = {
      'Free Trial': 1,
      'Starter': 1,
      'Grow': 2,
      'Pro': 5,
    };
    return limits[planName as keyof typeof limits] || 1;
  };

  const canAddWebsite = websites && user ? websites.length < getPlanWebsiteLimit(user.subscription || 'Free Trial') : false;

  return (
    <Layout title="Website Management">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Websites</h1>
          <p className="text-muted-foreground">
            Manage the websites you want to find backlink opportunities for
          </p>
        </div>
        <Button 
          onClick={() => setIsNewWebsiteDialogOpen(true)} 
          disabled={!canAddWebsite}
          className="shrink-0"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Website
        </Button>
      </div>

      {/* Current plan information */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium">Current Plan: <span className="text-primary-600">{user?.subscription || 'Free Trial'}</span></h3>
              <p className="text-muted-foreground mt-1">
                Your plan allows you to manage {getPlanWebsiteLimit(user?.subscription || 'Free Trial')} website{getPlanWebsiteLimit(user?.subscription || 'Free Trial') > 1 ? 's' : ''}.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/billing")}>
              Change Plan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Websites Table */}
      <div className="bg-white rounded-md border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Website</TableHead>
              <TableHead>Niche</TableHead>
              <TableHead>Opportunities</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingWebsites ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  <div className="flex justify-center">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : websites && websites.length > 0 ? (
              websites.map((website: any) => (
                <TableRow key={website.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-100 h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0">
                        <Globe className="h-5 w-5 text-gray-500" />
                      </div>
                      <div>
                        <div className="font-medium">{website.name}</div>
                        <div className="text-sm text-gray-500 flex items-center">
                          {website.url}
                          <a href={`https://${website.url}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 ml-1 inline-block">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-primary-50 text-primary-700 font-normal">
                      {website.niche}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="font-medium">{website.opportunities || 0}</span> found
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="text-primary-600">{website.trackingActive ? 'Active' : 'Inactive'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0" 
                        onClick={() => handleSettingsClick(website)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" 
                        onClick={() => handleDeleteClick(website)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  <div className="flex flex-col items-center gap-2">
                    <Globe className="h-8 w-8 text-gray-300" />
                    <h3 className="text-lg font-medium">No websites yet</h3>
                    <p className="text-gray-500">Add your first website to start finding backlink opportunities.</p>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsNewWebsiteDialogOpen(true)} 
                      className="mt-2"
                      disabled={!canAddWebsite}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Website
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Website Dialog */}
      <Dialog open={isNewWebsiteDialogOpen} onOpenChange={setIsNewWebsiteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add a new website</DialogTitle>
            <DialogDescription>
              Enter your website details to find relevant backlink opportunities.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Personal Blog" {...field} />
                    </FormControl>
                    <FormDescription>
                      This is how you'll identify your website in the dashboard.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website URL</FormLabel>
                    <FormControl>
                      <Input placeholder="example.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      Enter your domain without 'http://' or 'www.'
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="niche"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website Niche</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a niche" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="saas">SaaS</SelectItem>
                        <SelectItem value="ecommerce">E-commerce</SelectItem>
                        <SelectItem value="technology">Technology</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="health">Health & Fitness</SelectItem>
                        <SelectItem value="food">Food & Recipe</SelectItem>
                        <SelectItem value="travel">Travel</SelectItem>
                        <SelectItem value="education">Education</SelectItem>
                        <SelectItem value="lifestyle">Lifestyle</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the niche that best describes your website's topic.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsNewWebsiteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={addWebsiteMutation.isPending}
                >
                  {addWebsiteMutation.isPending && (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  )}
                  Add Website
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Website Settings Dialog */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Website Settings</DialogTitle>
            <DialogDescription>
              Update your website details and preferences.
            </DialogDescription>
          </DialogHeader>
          <Form {...settingsForm}>
            <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-6">
              <FormField
                control={settingsForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={settingsForm.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website URL</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      Enter your domain without 'http://' or 'www.'
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={settingsForm.control}
                name="niche"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website Niche</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="saas">SaaS</SelectItem>
                        <SelectItem value="ecommerce">E-commerce</SelectItem>
                        <SelectItem value="technology">Technology</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="health">Health & Fitness</SelectItem>
                        <SelectItem value="food">Food & Recipe</SelectItem>
                        <SelectItem value="travel">Travel</SelectItem>
                        <SelectItem value="education">Education</SelectItem>
                        <SelectItem value="lifestyle">Lifestyle</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsSettingsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateWebsiteMutation.isPending}
                >
                  {updateWebsiteMutation.isPending && (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Website Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Delete Website</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this website? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 border border-red-100 rounded-md p-4 my-4">
            <div className="font-medium text-red-800">
              {selectedWebsite?.name}
            </div>
            <div className="text-sm text-red-600">
              {selectedWebsite?.url}
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deleteWebsiteMutation.isPending}
            >
              {deleteWebsiteMutation.isPending && (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
              )}
              Delete Website
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}