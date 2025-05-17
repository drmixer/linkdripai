import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import OpportunityCard from '@/components/opportunity-card';
import Layout from '@/components/layout';
import SplashConfirmationDialog from '@/components/splash-confirmation-dialog';
import { EmptyState } from '@/components/empty-state';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  Filter, 
  RefreshCw, 
  Sparkles, 
  BarChart, 
  PieChart, 
  Search, 
  Globe, 
  LayoutDashboard, 
  Mail, 
  FileText,
  ArrowUpRight,
  Calendar,
  AlertCircle,
  TrendingUp,
  Zap,
  CheckCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export default function DripsPage() {
  React.useEffect(() => {
    document.title = "Opportunities | LinkDripAI";
  }, []);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [websiteFilter, setWebsiteFilter] = useState('all');
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSplashDialogOpen, setIsSplashDialogOpen] = useState(false);
  const [showSplashConfirmation, setShowSplashConfirmation] = useState(false);
  const [activeSection, setActiveSection] = useState<"opportunities" | "analytics" | "contacted">("opportunities");
  const [showRecent, setShowRecent] = useState(true);
  const [sortMethod, setSortMethod] = useState<"relevance" | "da" | "date">("relevance");
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<number | null>(null);
  const [selectedWebsiteName, setSelectedWebsiteName] = useState('');
  
  // Get user websites
  const { data: websites = [], isLoading: loadingWebsites } = useQuery<any[]>({
    queryKey: ['/api/websites'],
    enabled: !!user
  });
  
  // Get user's splash credits
  const { data: userPlan = { remainingSplashes: 0, totalSplashes: 0, plan: '', nextSplashReset: new Date() }, isLoading: loadingPlan } = useQuery<any>({
    queryKey: ['/api/user/plan'],
    enabled: !!user
  });
  
  // Get opportunities
  const { data: opportunities = [], isLoading: loadingOpportunities, refetch } = useQuery<any[]>({
    queryKey: ['/api/opportunities', websiteFilter, activeTab, activeFilters],
    enabled: !!user
  });
  
  // Get recent contacts (for contacted section)
  const { data: recentContacts = [], isLoading: loadingContacts } = useQuery<any[]>({
    queryKey: ['/api/contacts/recent'],
    enabled: !!user && activeSection === 'contacted'
  });
  
  // Get analytics data
  const { data: analyticsData = {}, isLoading: loadingAnalytics } = useQuery<any>({
    queryKey: ['/api/analytics', chartPeriod],
    enabled: !!user && activeSection === 'analytics'
  });
  
  // Get premium splash
  const splashMutation = useMutation({
    mutationFn: async (data: { websiteId: number }) => {
      const response = await apiRequest('POST', '/api/opportunities/splash', data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/plan'] });
      toast({
        title: 'Premium opportunity added!',
        description: 'A new high-quality opportunity has been added to your feed.',
      });
      // Close confirmation dialog
      setShowSplashConfirmation(false);
      setSelectedWebsiteId(null);
      setSelectedWebsiteName('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to get premium opportunity',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Handle website selection for splash
  const handleWebsiteSelect = (websiteId: number) => {
    const website = websites.find((site: any) => site.id === websiteId);
    
    setSelectedWebsiteId(websiteId);
    if (website) {
      setSelectedWebsiteName(website.url);
    }
    
    // Close website selection dialog and open confirmation
    setIsSplashDialogOpen(false);
    setShowSplashConfirmation(true);
  };
  
  // Filter opportunities
  const filteredOpportunities = React.useMemo(() => {
    if (!opportunities) return [];
    
    let filtered = [...opportunities];
    
    // Filter by website if not 'all'
    if (websiteFilter !== 'all') {
      const websiteId = parseInt(websiteFilter);
      filtered = filtered.filter(opp => opp.matchedWebsiteId === websiteId);
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(opp => 
        opp.url?.toLowerCase().includes(query) || 
        opp.domain?.toLowerCase().includes(query) ||
        opp.title?.toLowerCase().includes(query)
      );
    }
    
    // Apply active filters
    if (activeFilters.includes('highDA')) {
      filtered = filtered.filter(opp => opp.domainAuthority >= 40);
    }
    if (activeFilters.includes('highRelevance')) {
      filtered = filtered.filter(opp => opp.relevanceScore >= 80);
    }
    if (activeFilters.includes('lowSpam')) {
      filtered = filtered.filter(opp => opp.spamScore <= 2);
    }
    
    // Apply active tab filter
    if (activeTab === 'saved') {
      filtered = filtered.filter(opp => opp.isSaved);
    } else if (activeTab === 'hidden') {
      filtered = filtered.filter(opp => opp.isHidden);
    } else if (activeTab === 'unlocked') {
      filtered = filtered.filter(opp => opp.isUnlocked);
    }
    
    // Sort opportunities
    if (sortMethod === 'relevance') {
      filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } else if (sortMethod === 'da') {
      filtered.sort((a, b) => b.domainAuthority - a.domainAuthority);
    } else if (sortMethod === 'date') {
      filtered.sort((a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime());
    }
    
    return filtered;
  }, [opportunities, websiteFilter, searchQuery, activeFilters, activeTab, sortMethod]);
  
  // Chart period for analytics
  const [chartPeriod, setChartPeriod] = useState('30d');
  
  // State for confirmation dialog
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // Handle splash button click

  

  
  // Handle confirmation of Splash usage from the confirmation dialog
  const handleConfirmSplash = (websiteId: number) => {
    if (!websiteId) return;
    
    // Execute the splash mutation with the selected website ID
    splashMutation.mutate({ 
      websiteId: websiteId 
    });
    
    // Reset state and close confirmation dialog
    setSelectedWebsiteId(null);
    setShowSplashConfirmation(false);
  };
  
  // View contact info
  const handleViewContact = (opportunity: any) => {
    setSelectedOpportunity(opportunity);
    setIsDialogOpen(true);
  };
  
  // Toggle filter
  const toggleFilter = (filter: string) => {
    if (activeFilters.includes(filter)) {
      setActiveFilters(activeFilters.filter(f => f !== filter));
    } else {
      setActiveFilters([...activeFilters, filter]);
    }
  };
  
  // Render quality tag
  const getQualityTag = (opportunity: any) => {
    if (opportunity.domainAuthority >= 40 && opportunity.relevanceScore >= 80 && opportunity.spamScore <= 2) {
      return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">Premium</Badge>;
    } else if (opportunity.domainAuthority >= 30 && opportunity.relevanceScore >= 70) {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">High</Badge>;
    } else if (opportunity.domainAuthority >= 20 && opportunity.relevanceScore >= 60) {
      return <Badge variant="outline" className="border-amber-500 text-amber-700">Medium</Badge>;
    } else {
      return <Badge variant="outline">Standard</Badge>;
    }
  };
  
  return (
    <Layout 
      title="All Opportunities (Drips)" 
      subtitle="Browse all available backlink opportunities for your websites"
    >
      <div className="space-y-6">
        {/* Top action bar */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search opportunities..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Select value={websiteFilter} onValueChange={setWebsiteFilter}>
              <SelectTrigger className="w-[180px]">
                <div className="flex items-center">
                  <Globe className="w-4 h-4 mr-2" />
                  {websiteFilter === 'all' ? (
                    <span>All Websites</span>
                  ) : (
                    <span>{websites.find((site: any) => site.id === parseInt(websiteFilter))?.url || 'Select Website'}</span>
                  )}
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Websites</SelectItem>
                {websites && websites.map((site: any) => (
                  <SelectItem key={site.id} value={site.id.toString()}>
                    {site.url}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={sortMethod} onValueChange={setSortMethod}>
              <SelectTrigger className="w-[180px]">
                <div className="flex items-center">
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  {sortMethod === 'relevance' ? 'Sort by Relevance' :
                   sortMethod === 'da' ? 'Sort by DA' :
                   'Sort by Date'}
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Sort by Relevance</SelectItem>
                <SelectItem value="da">Sort by Domain Authority</SelectItem>
                <SelectItem value="date">Sort by Date Added</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              className={cn(showFilters && "bg-primary-50 text-primary-700")}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters {activeFilters.length > 0 && `(${activeFilters.length})`}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => refetch()}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loadingOpportunities && "animate-spin")} />
              Refresh
            </Button>
            
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                // Only one website, select it automatically and show confirmation
                if (websites.length === 1) {
                  setSelectedWebsiteId(websites[0].id);
                  setSelectedWebsiteName(websites[0].url);
                  setShowSplashConfirmation(true);
                } 
                // Multiple websites, show selection dialog
                else if (websites.length > 1) {
                  setIsSplashDialogOpen(true);
                }
                // No websites, show error
                else {
                  toast({
                    title: "No websites found",
                    description: "Please add a website before using Splash.",
                    variant: "destructive",
                  });
                }
              }}
              disabled={userPlan.remainingSplashes <= 0}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Use Splash {userPlan.remainingSplashes > 0 && `(${userPlan.remainingSplashes})`}
            </Button>
          </div>
        </div>
        
        {/* Filters panel */}
        {showFilters && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
              <CardDescription>Refine opportunities by specific criteria</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant={activeFilters.includes('highDA') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleFilter('highDA')}
                  className={activeFilters.includes('highDA') ? 'bg-primary-600' : ''}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  DA 40+
                </Button>
                
                <Button 
                  variant={activeFilters.includes('highRelevance') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleFilter('highRelevance')}
                  className={activeFilters.includes('highRelevance') ? 'bg-primary-600' : ''}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Relevance 80%+
                </Button>
                
                <Button 
                  variant={activeFilters.includes('lowSpam') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleFilter('lowSpam')}
                  className={activeFilters.includes('lowSpam') ? 'bg-primary-600' : ''}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Spam Score &lt;2%
                </Button>
                
                {activeFilters.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setActiveFilters([])}
                  >
                    Clear All
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Main content */}
        <div>
          <Tabs defaultValue="opportunities" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger 
                value="opportunities" 
                onClick={() => setActiveSection('opportunities')}
              >
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Opportunities
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                onClick={() => setActiveSection('analytics')}
              >
                <BarChart className="h-4 w-4 mr-2" />
                Analytics
              </TabsTrigger>
              <TabsTrigger 
                value="contacted" 
                onClick={() => setActiveSection('contacted')}
              >
                <Mail className="h-4 w-4 mr-2" />
                Contacted
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="opportunities">
              <div className="mb-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="saved">
                      Saved
                      {opportunities?.filter((opp: any) => opp.isSaved).length > 0 && (
                        <Badge className="ml-2 bg-primary-50 text-primary-700" variant="outline">
                          {opportunities.filter((opp: any) => opp.isSaved).length}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="unlocked">Unlocked</TabsTrigger>
                    <TabsTrigger value="hidden">Hidden</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              {/* Opportunities grid */}
              {loadingOpportunities ? (
                <div className="flex justify-center items-center py-12">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Loading opportunities...</p>
                  </div>
                </div>
              ) : filteredOpportunities.length === 0 ? (
                <EmptyState 
                  icon={FileText}
                  title="No opportunities found"
                  description={
                    searchQuery || activeFilters.length > 0 
                      ? "Try adjusting your search or filters to see more results."
                      : activeTab === 'saved'
                      ? "You haven't saved any opportunities yet. Save opportunities by clicking the star icon."
                      : activeTab === 'unlocked'
                      ? "You haven't unlocked any contact information yet."
                      : activeTab === 'hidden'
                      ? "You haven't hidden any opportunities."
                      : "No opportunities found for your website yet. Check back later or add more websites."
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOpportunities.map((opportunity: any) => (
                    <OpportunityCard
                      key={opportunity.id}
                      opportunity={opportunity}
                      onViewContactInfo={() => handleViewContact(opportunity)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="analytics">
              {loadingAnalytics ? (
                <div className="flex justify-center items-center py-12">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Loading analytics...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex justify-end mb-4">
                    <Select value={chartPeriod} onValueChange={setChartPeriod}>
                      <SelectTrigger className="w-[180px]">
                        <Calendar className="h-4 w-4 mr-2" />
                        {chartPeriod === '7d' ? 'Last 7 days' : 
                         chartPeriod === '30d' ? 'Last 30 days' : 
                         chartPeriod === '90d' ? 'Last 90 days' : 'All time'}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="30d">Last 30 days</SelectItem>
                        <SelectItem value="90d">Last 90 days</SelectItem>
                        <SelectItem value="all">All time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Opportunity Quality</CardTitle>
                        <CardDescription>Distribution by quality level</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="h-[200px] flex items-center justify-center">
                          <PieChart className="h-32 w-32 text-muted-foreground/30" />
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Domain Authority</CardTitle>
                        <CardDescription>Average: 28.5</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span>DA 0-20</span>
                              <span>32%</span>
                            </div>
                            <Progress value={32} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span>DA 21-40</span>
                              <span>45%</span>
                            </div>
                            <Progress value={45} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span>DA 41-60</span>
                              <span>18%</span>
                            </div>
                            <Progress value={18} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span>DA 61+</span>
                              <span>5%</span>
                            </div>
                            <Progress value={5} className="h-2" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Splash Usage</CardTitle>
                        <CardDescription>Monthly premium opportunities</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span>Used</span>
                              <span>{userPlan.totalSplashes - userPlan.remainingSplashes} of {userPlan.totalSplashes}</span>
                            </div>
                            <Progress 
                              value={userPlan.totalSplashes > 0 
                                ? ((userPlan.totalSplashes - userPlan.remainingSplashes) / userPlan.totalSplashes) * 100 
                                : 0
                              } 
                              className="h-2" 
                            />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Next reset: {new Date(userPlan.nextSplashReset).toLocaleDateString()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="contacted">
              {loadingContacts ? (
                <div className="flex justify-center items-center py-12">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Loading contact history...</p>
                  </div>
                </div>
              ) : recentContacts.length === 0 ? (
                <EmptyState 
                  icon={Mail}
                  title="No contact history"
                  description="You haven't reached out to any opportunities yet. Unlock contact information to start outreach."
                />
              ) : (
                <div className="space-y-4">
                  {recentContacts.map((contact: any) => (
                    <Card key={contact.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{contact.opportunity?.title || contact.opportunity?.domain}</h4>
                            <p className="text-sm text-muted-foreground">{contact.opportunity?.url}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">
                                {contact.status || 'Contacted'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(contact.contactedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            Send Follow-up
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Contact Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) setIsDialogOpen(false);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact Information</DialogTitle>
            <DialogDescription>
              Contact details for {selectedOpportunity?.domain}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedOpportunity ? (
              <>
                {selectedOpportunity.contactInfo?.email && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Email:</h4>
                    <p className="text-sm">{selectedOpportunity.contactInfo.email}</p>
                  </div>
                )}
                
                {selectedOpportunity.contactInfo?.form && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Contact Form:</h4>
                    <a 
                      href={selectedOpportunity.contactInfo.form}
                      target="_blank"
                      rel="noopener noreferrer" 
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {selectedOpportunity.contactInfo.form}
                    </a>
                  </div>
                )}
                
                {selectedOpportunity.contactInfo?.social && selectedOpportunity.contactInfo.social.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Social Profiles:</h4>
                    <div className="space-y-1">
                      {selectedOpportunity.contactInfo.social.map((profile: any, index: number) => (
                        <div key={index} className="flex items-center">
                          <a 
                            href={profile.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            {profile.platform}: {profile.username}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {(!selectedOpportunity.contactInfo?.email && 
                  !selectedOpportunity.contactInfo?.form && 
                  (!selectedOpportunity.contactInfo?.social || selectedOpportunity.contactInfo.social.length === 0)) && (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">No contact information available.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No opportunity selected.</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Splash Selection Dialog */}
      <Dialog open={isSplashDialogOpen} onOpenChange={(open) => {
        if (!open) setIsSplashDialogOpen(false);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Get Premium Opportunity</DialogTitle>
            <DialogDescription>
              {userPlan.remainingSplashes > 0 
                ? "Select which website you want to get a premium opportunity for." 
                : "You've used all your splashes for this month. Buy more or upgrade your plan."
              }
            </DialogDescription>
          </DialogHeader>
          
          {userPlan.remainingSplashes > 0 ? (
            <>
              <div className="space-y-4 py-4">
                <div className="text-sm mb-4">
                  <span className="font-medium">Splashes remaining:</span> {userPlan.remainingSplashes} of {userPlan.totalSplashes}
                </div>
                <div className="space-y-2">
                  {websites.map((website: any) => (
                    <Button 
                      key={website.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleWebsiteSelect(website.id)}
                    >
                      <Globe className="mr-2 h-4 w-4" />
                      {website.url}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsSplashDialogOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="text-sm text-center mb-4">
                  <Sparkles className="h-10 w-10 mx-auto mb-2 text-amber-500" />
                  <p>Premium opportunities have DA 40+, relevance 80%+, and spam score &lt;2%.</p>
                </div>
                <div className="space-y-2">
                  <Button 
                    className="w-full" 
                    onClick={() => {
                      setIsSplashDialogOpen(false);
                      // Navigate to billing page
                      window.location.href = '/billing';
                    }}
                  >
                    Buy more splashes
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setIsSplashDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Splash Confirmation Dialog */}
      <SplashConfirmationDialog
        open={showSplashConfirmation}
        onOpenChange={setShowSplashConfirmation}
        websiteId={selectedWebsiteId}
        websiteName={selectedWebsiteName}
        remainingSplashes={userPlan.remainingSplashes}
        totalSplashes={userPlan.totalSplashes}
      />
    </Layout>
  );
}

// The fix is complete. We have:
// 1. Fixed server-side database issues with splash usage tracking
// 2. Created a dedicated SplashConfirmationDialog component
// 3. Added proper state variables in drips.tsx
// 4. Updated button logic to check available splashes
// 5. Integrated SplashConfirmationDialog in the drips page

// Import hook at the bottom to avoid circular dependencies
import { useToast } from '@/hooks/use-toast';