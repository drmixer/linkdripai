import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import OpportunityCard from '@/components/opportunity-card';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  Filter, 
  RefreshCw, 
  Sparkles, 
  Info, 
  ChevronRight, 
  BarChart, 
  PieChart, 
  Search, 
  Globe, 
  Zap, 
  Star, 
  ChevronDown, 
  Check, 
  LayoutDashboard, 
  Calendar, 
  Mail, 
  FileText,
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  User
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { EmptyState } from '@/components/custom/empty-state';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useToast } from '@/hooks/use-toast';

export default function OpportunitiesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [websiteFilter, setWebsiteFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<{
    minDA?: number;
    maxSpamScore?: number;
    sourceTypes?: string[];
  }>({});
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);
  
  // New state variables for enhanced dashboard
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "year">("week");
  const [activeSection, setActiveSection] = useState<"opportunities" | "analytics" | "contacted">("opportunities");
  const [showRecent, setShowRecent] = useState(true);
  const [sortMethod, setSortMethod] = useState<"relevance" | "da" | "date">("relevance");
  
  // Get user websites
  const { data: websites, isLoading: loadingWebsites } = useQuery({
    queryKey: ['/api/websites'],
    enabled: !!user
  });
  
  // Get user's splash credits
  const { data: userPlan, isLoading: loadingPlan } = useQuery({
    queryKey: ['/api/user/plan'],
    enabled: !!user
  });
  
  // Get opportunities
  const { data: opportunities, isLoading: loadingOpportunities, refetch } = useQuery({
    queryKey: ['/api/opportunities', websiteFilter, activeTab, activeFilters],
    enabled: !!user
  });
  
  // Get recent contacts (for contacted section)
  const { data: recentContacts, isLoading: loadingContacts } = useQuery({
    queryKey: ['/api/contacts/recent'],
    enabled: !!user && activeSection === 'contacted'
  });
  
  // Get analytics data
  const { data: analyticsData, isLoading: loadingAnalytics } = useQuery({
    queryKey: ['/api/analytics', chartPeriod],
    enabled: !!user && activeSection === 'analytics'
  });
  
  // Get premium splash
  const splashMutation = useMutation({
    mutationFn: async (websiteId: number) => {
      const response = await apiRequest('POST', '/api/opportunities/splash', { websiteId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Splash used successfully!",
        description: "A high-quality opportunity (DA 40+) has been added to your list",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/plan'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error using Splash",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Contact opportunity
  const contactMutation = useMutation({
    mutationFn: async (opportunityId: number) => {
      const response = await apiRequest('POST', `/api/opportunities/${opportunityId}/contact`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Contact info copied!",
        description: "The contact information has been copied to your clipboard"
      });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error getting contact info",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
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
    
    // Apply active filters if any
    if (activeFilters.minDA) {
      filtered = filtered.filter(opp => (opp.domainAuthority || 0) >= activeFilters.minDA!);
    }
    
    if (activeFilters.maxSpamScore !== undefined) {
      filtered = filtered.filter(opp => 
        opp.spamScore === undefined || opp.spamScore <= activeFilters.maxSpamScore!
      );
    }
    
    if (activeFilters.sourceTypes && activeFilters.sourceTypes.length > 0) {
      filtered = filtered.filter(opp => 
        activeFilters.sourceTypes!.includes(opp.sourceType)
      );
    }
    
    // Filter by tab
    if (activeTab === 'premium') {
      filtered = filtered.filter(opp => opp.isPremium);
    }
    
    return filtered;
  }, [opportunities, websiteFilter, searchQuery, activeFilters, activeTab]);
  
  // Handle "use splash" action
  const handleUseSplash = (websiteId: number) => {
    if (userPlan && userPlan.remainingSplashes > 0) {
      splashMutation.mutate(websiteId);
    } else {
      toast({
        title: "No Splash credits",
        description: "You don't have any remaining Splash credits. Upgrade your plan or purchase additional Splash credits.",
        variant: "destructive"
      });
    }
  };
  
  // Handle contact button click
  const handleContactClick = (opportunity: any) => {
    setSelectedOpportunity(opportunity);
    setIsDialogOpen(true);
  };
  
  // Calculate stats
  const stats = React.useMemo(() => {
    if (!opportunities) return { total: 0, premium: 0, today: 0 };
    
    const premium = opportunities.filter(opp => opp.isPremium).length;
    const today = opportunities.filter(opp => {
      const oppDate = new Date(opp.discoveredAt || Date.now());
      const today = new Date();
      return oppDate.toDateString() === today.toDateString();
    }).length;
    
    return {
      total: opportunities.length,
      premium,
      today
    };
  }, [opportunities]);
  
  // Determine loading state based on active section
  const isLoading = () => {
    if (loadingWebsites || loadingPlan) return true;
    if (activeSection === 'opportunities' && loadingOpportunities) return true;
    if (activeSection === 'analytics' && loadingAnalytics) return true;
    if (activeSection === 'contacted' && loadingContacts) return true;
    return false;
  };
  
  // Loading state
  if (isLoading()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={40} className="animate-spin mb-4 text-primary" />
        <h3 className="text-xl font-medium">Loading dashboard...</h3>
        <p className="text-muted-foreground">We're preparing your personalized insights</p>
      </div>
    );
  }
  
  // Empty opportunities state
  const showEmptyState = activeSection === 'opportunities' && (!opportunities || opportunities.length === 0);
  if (showEmptyState) {
    return (
      <EmptyState
        title="No opportunities yet"
        description="We're still discovering personalized opportunities for your websites. Check back soon!"
        icon={<RefreshCw size={50} />}
        action={
          <Button onClick={() => refetch()}>
            Refresh
          </Button>
        }
      />
    );
  }
  
  return (
    <div className="container pb-8 max-w-7xl">
      <div className="flex flex-col gap-6">
        {/* Enhanced header with tabs navigation */}
        <div className="sticky top-0 z-10 bg-background pt-6 pb-3 border-b">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">All Opportunities (Drips)</h1>
              <p className="text-muted-foreground mt-1">
                Discover and manage backlink opportunities for your websites
              </p>
            </div>
            
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <User size={16} />
                    {user?.username}
                    <ChevronDown size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Globe className="mr-2 h-4 w-4" />
                    <span>My Websites</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Sparkles className="mr-2 h-4 w-4" />
                    <span>My Plan: {userPlan?.plan || 'Free'}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                    <span>Upgrade Plan</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button 
                variant="outline" 
                onClick={() => refetch()}
                className="gap-2"
                size="icon"
              >
                <RefreshCw size={16} />
              </Button>
            </div>
          </div>
          
          {/* Main navigation tabs */}
          <div className="flex space-x-1 border-b pb-3">
            <Button
              variant={activeSection === 'opportunities' ? 'secondary' : 'ghost'}
              className="gap-2"
              onClick={() => setActiveSection('opportunities')}
            >
              <Zap size={16} />
              Opportunities
            </Button>
            <Button
              variant={activeSection === 'contacted' ? 'secondary' : 'ghost'}
              className="gap-2"
              onClick={() => setActiveSection('contacted')}
            >
              <Mail size={16} />
              Contacted
            </Button>
            <Button
              variant={activeSection === 'analytics' ? 'secondary' : 'ghost'}
              className="gap-2"
              onClick={() => setActiveSection('analytics')}
            >
              <BarChart size={16} />
              Analytics
            </Button>
          </div>
        </div>
        
        {/* Dashboard Overview - Enhanced Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                {stats.total}
                <Badge variant="outline" className="text-xs font-normal ml-auto">
                  Total
                </Badge>
              </CardTitle>
              <CardDescription className="flex items-center">
                Available Opportunities
                <TrendingUp className="h-4 w-4 text-green-500 ml-auto" />
              </CardDescription>
            </CardHeader>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
          </Card>
          
          <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                {stats.premium}
                <Badge variant="outline" className="text-xs font-normal ml-auto bg-purple-50 text-purple-700 border-purple-200">
                  Premium
                </Badge>
              </CardTitle>
              <CardDescription className="flex items-center">
                Premium Opportunities
                <Star className="h-4 w-4 text-purple-500 ml-auto" />
              </CardDescription>
            </CardHeader>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
          </Card>
          
          <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                {stats.today}
                <Badge variant="outline" className="text-xs font-normal ml-auto bg-green-50 text-green-700 border-green-200">
                  Today
                </Badge>
              </CardTitle>
              <CardDescription className="flex items-center">
                New Discoveries
                <Calendar className="h-4 w-4 text-green-500 ml-auto" />
              </CardDescription>
            </CardHeader>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-teal-500" />
          </Card>
          
          <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                {userPlan?.remainingSplashes || 0}
                <Badge variant="outline" className="text-xs font-normal ml-auto bg-blue-50 text-blue-700 border-blue-200">
                  Available
                </Badge>
              </CardTitle>
              <CardDescription className="flex items-center">
                Splashes
                <Sparkles className="h-4 w-4 text-blue-500 ml-auto" />
              </CardDescription>
            </CardHeader>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
          </Card>
        </div>
        
        {/* Enhanced search and filter bar */}
        <div className="flex flex-col md:flex-row gap-4 items-start">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input 
              placeholder="Search by domain, title, or URL..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          
          <div className="flex gap-2 flex-wrap md:flex-nowrap">
            <Select 
              value={websiteFilter} 
              onValueChange={setWebsiteFilter}
            >
              <SelectTrigger className="w-[180px] md:w-[200px]">
                <Globe size={16} className="mr-2 text-gray-500" />
                <SelectValue placeholder="All websites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All websites</SelectItem>
                {websites && websites.map((website: any) => (
                  <SelectItem key={website.id} value={website.id.toString()}>
                    {website.url}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter size={16} />
                  Filters
                  {Object.keys(activeFilters).length > 0 && (
                    <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                      {Object.keys(activeFilters).length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60">
                <DropdownMenuLabel>Filter Opportunities</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <div className="p-2 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Min Domain Authority</Label>
                    <Select 
                      value={activeFilters.minDA?.toString() || 'any'} 
                      onValueChange={(value) => setActiveFilters(prev => ({
                        ...prev,
                        minDA: value === 'any' ? undefined : parseInt(value)
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any DA" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any DA</SelectItem>
                        <SelectItem value="10">DA 10+</SelectItem>
                        <SelectItem value="20">DA 20+</SelectItem>
                        <SelectItem value="30">DA 30+</SelectItem>
                        <SelectItem value="40">DA 40+</SelectItem>
                        <SelectItem value="50">DA 50+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs">Max Spam Score</Label>
                    <Select 
                      value={activeFilters.maxSpamScore?.toString() || 'any'} 
                      onValueChange={(value) => setActiveFilters(prev => ({
                        ...prev,
                        maxSpamScore: value === 'any' ? undefined : parseInt(value)
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any Score" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any Score</SelectItem>
                        <SelectItem value="1">1 or less</SelectItem>
                        <SelectItem value="3">3 or less</SelectItem>
                        <SelectItem value="5">5 or less</SelectItem>
                        <SelectItem value="7">7 or less</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {Object.keys(activeFilters).length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-2"
                      onClick={() => setActiveFilters({})}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <ArrowUpRight size={16} />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortMethod("relevance")}>
                  {sortMethod === "relevance" && <Check className="mr-2 h-4 w-4" />}
                  <span>By Relevance</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortMethod("da")}>
                  {sortMethod === "da" && <Check className="mr-2 h-4 w-4" />}
                  <span>By Domain Authority</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortMethod("date")}>
                  {sortMethod === "date" && <Check className="mr-2 h-4 w-4" />}
                  <span>By Date Added</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button 
              variant={viewMode === "grid" ? "secondary" : "outline"}
              size="icon"
              onClick={() => setViewMode("grid")}
              className="hidden md:flex"
            >
              <LayoutDashboard size={16} />
            </Button>
            
            <Button 
              variant={viewMode === "list" ? "secondary" : "outline"}
              size="icon"
              onClick={() => setViewMode("list")}
              className="hidden md:flex"
            >
              <FileText size={16} />
            </Button>
          </div>
        </div>
        
        {/* Splash Section (Upgraded UI) */}
        <Card className="relative overflow-hidden border-0 shadow-md">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-indigo-600/10" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
          
          <CardHeader className="relative">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full blur-[2px]" />
                <div className="relative bg-gradient-to-r from-purple-500 to-indigo-500 text-white p-1.5 rounded-full">
                  <Sparkles size={20} />
                </div>
              </div>
              <div>
                <CardTitle className="text-xl font-bold">Splash</CardTitle>
                <CardDescription>
                  Discover top-tier opportunities with superior metrics and relevance
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="relative space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Your Splash Credits</span>
                    <Badge variant="outline" className="bg-purple-100 text-purple-800">
                      {userPlan?.remainingSplashes || 0} / {userPlan?.totalSplashes || 0}
                    </Badge>
                  </div>
                  <Progress 
                    value={userPlan ? (userPlan.remainingSplashes / userPlan.totalSplashes) * 100 : 0} 
                    className="h-2.5 bg-gray-100" 
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Next reset: {userPlan?.nextSplashReset ? new Date(userPlan.nextSplashReset).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  {userPlan?.remainingSplashes > 0 ? (
                    <Button 
                      className="gap-2 relative overflow-hidden bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md"
                      onClick={() => handleUseSplash(
                        websites && websites.length > 0 
                          ? parseInt(websiteFilter === 'all' ? websites[0].id : websiteFilter) 
                          : 0
                      )}
                    >
                      <Sparkles size={16} className="relative z-10" />
                      <span className="relative z-10">Use Splash</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-400/30 to-indigo-400/30 w-full translate-y-full hover:translate-y-0 transition-transform duration-300" />
                    </Button>
                  ) : (
                    <Button 
                      className="gap-2 bg-purple-600 hover:bg-purple-700" 
                      onClick={() => window.location.href = '/pricing'}
                    >
                      <Sparkles size={16} />
                      Get More Splashes
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="relative p-4 rounded-xl bg-white/50 border border-purple-100">
                <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Star size={16} className="text-purple-500" />
                  Premium Quality Thresholds
                </h4>
                <ul className="space-y-2">
                  <li className="flex items-center text-sm">
                    <Badge variant="outline" className="mr-2 bg-blue-50 text-blue-700 border-blue-200">DA 40+</Badge>
                    <span>Higher Domain Authority</span>
                  </li>
                  <li className="flex items-center text-sm">
                    <Badge variant="outline" className="mr-2 bg-green-50 text-green-700 border-green-200">Spam &lt;2</Badge>
                    <span>Lower Spam Score</span>
                  </li>
                  <li className="flex items-center text-sm">
                    <Badge variant="outline" className="mr-2 bg-purple-50 text-purple-700 border-purple-200">80%+</Badge>
                    <span>Higher Content Relevance</span>
                  </li>
                  <li className="flex items-center text-sm">
                    <Badge variant="outline" className="mr-2 bg-amber-50 text-amber-700 border-amber-200">Verified</Badge>
                    <span>Valid Contact Methods</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Filters section (conditionally shown) */}
        {showFilters && (
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Filters & Sorting</CardTitle>
              <CardDescription>
                Refine your opportunities to find the perfect matches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <Label>Website</Label>
                  <Select 
                    value={websiteFilter} 
                    onValueChange={setWebsiteFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All websites" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All websites</SelectItem>
                      {websites && websites.map((website: any) => (
                        <SelectItem key={website.id} value={website.id.toString()}>
                          {website.url}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-3">
                  <Label>Min Domain Authority</Label>
                  <Select 
                    value={activeFilters.minDA?.toString() || 'any'} 
                    onValueChange={(value) => setActiveFilters(prev => ({
                      ...prev,
                      minDA: value === 'any' ? undefined : parseInt(value)
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any DA" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any DA</SelectItem>
                      <SelectItem value="10">DA 10+</SelectItem>
                      <SelectItem value="20">DA 20+</SelectItem>
                      <SelectItem value="30">DA 30+</SelectItem>
                      <SelectItem value="40">DA 40+</SelectItem>
                      <SelectItem value="50">DA 50+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-3">
                  <Label>Max Spam Score</Label>
                  <Select 
                    value={activeFilters.maxSpamScore?.toString() || 'any'} 
                    onValueChange={(value) => setActiveFilters(prev => ({
                      ...prev,
                      maxSpamScore: value === 'any' ? undefined : parseInt(value)
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any spam score" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any spam score</SelectItem>
                      <SelectItem value="1">1 or less</SelectItem>
                      <SelectItem value="2">2 or less</SelectItem>
                      <SelectItem value="3">3 or less</SelectItem>
                      <SelectItem value="5">5 or less</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="md:col-span-3">
                  <div className="flex items-center justify-between">
                    <Label className="mb-3">Source Type</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveFilters(prev => ({
                        ...prev,
                        sourceTypes: undefined
                      }))}
                      className="h-auto py-1"
                    >
                      Reset
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['blog', 'resource_page', 'directory', 'guest_post', 'competitor_backlink', 'forum', 'social_mention'].map(type => (
                      <div key={type} className="flex items-center space-x-2">
                        <Switch
                          id={`filter-${type}`}
                          checked={activeFilters.sourceTypes?.includes(type) || false}
                          onCheckedChange={(checked) => {
                            setActiveFilters(prev => {
                              const current = prev.sourceTypes || [];
                              const updated = checked
                                ? [...current, type]
                                : current.filter(t => t !== type);
                              
                              return {
                                ...prev,
                                sourceTypes: updated.length ? updated : undefined
                              };
                            });
                          }}
                        />
                        <Label htmlFor={`filter-${type}`} className="capitalize">
                          {type.replace('_', ' ')}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex justify-between">
              <Button 
                variant="outline"
                onClick={() => setActiveFilters({})}
              >
                Reset All Filters
              </Button>
              <Button 
                variant="default"
                onClick={() => setShowFilters(false)}
              >
                Apply Filters
              </Button>
            </CardFooter>
          </Card>
        )}
        
        {/* Search and tabs */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="w-full md:w-64 relative">
            <Input
              placeholder="Search opportunities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
            <div className="absolute left-2.5 top-2.5 text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
          </div>
          
          <Tabs 
            defaultValue="all" 
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full md:w-auto"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="all">All Opportunities</TabsTrigger>
              <TabsTrigger value="premium">
                Premium Only
                <Badge className="ml-2 bg-purple-100 text-purple-800 hover:bg-purple-100">{stats.premium}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {/* Section tabs for the different content types */}
        {activeSection === 'opportunities' && (
          <>
            {/* Results count */}
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Showing {filteredOpportunities.length} of {opportunities?.length || 0} opportunities
              </div>
              
              <Tabs 
                defaultValue="all" 
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full md:w-auto"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="all">All Opportunities</TabsTrigger>
                  <TabsTrigger value="premium" className="relative">
                    Premium Only
                    <Badge 
                      className="ml-2 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 text-purple-800 border-purple-200"
                    >
                      {stats.premium}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            {/* Opportunities display based on view mode */}
            {filteredOpportunities?.length === 0 ? (
              <EmptyState
                title="No matching opportunities"
                description="Try adjusting your filters to see more opportunities"
                icon={<Filter size={50} />}
                action={
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setActiveFilters({});
                      setSearchQuery('');
                    }}
                  >
                    Clear Filters
                  </Button>
                }
              />
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredOpportunities.map((opportunity: any) => (
                  <OpportunityCard
                    key={opportunity.id}
                    opportunity={opportunity}
                    isPremium={opportunity.isPremium}
                    websiteId={parseInt(websiteFilter === 'all' ? 
                      (opportunity.matchedWebsiteId || (websites && websites[0]?.id)) : 
                      websiteFilter
                    )}
                    onContactClick={handleContactClick}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filteredOpportunities.map((opportunity: any) => (
                  <Card key={opportunity.id} className={`${opportunity.isPremium ? 'border-purple-200 bg-purple-50/30' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row gap-4 items-start">
                        <div className="flex-grow">
                          <div className="flex items-center gap-2 mb-1">
                            {opportunity.isPremium && (
                              <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
                                <Sparkles className="h-3 w-3 mr-1" /> Premium
                              </Badge>
                            )}
                            <span className="text-sm font-medium">
                              DA: <span className="font-bold">{opportunity.domainAuthority || '?'}</span>
                            </span>
                            <span className="text-sm font-medium">
                              Spam: <span className="font-bold">{opportunity.spamScore !== undefined ? opportunity.spamScore : '?'}</span>
                            </span>
                            <span className="text-sm font-medium text-green-600">
                              Relevance: <span className="font-bold">{opportunity.relevanceScore ? `${Math.round(opportunity.relevanceScore * 100)}%` : 'N/A'}</span>
                            </span>
                          </div>
                          
                          <h3 className="text-lg font-bold mb-1 line-clamp-1">
                            {opportunity.title || opportunity.domain}
                          </h3>
                          
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {opportunity.description || opportunity.url}
                          </p>
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="rounded-sm h-5">
                              {opportunity.sourceType?.replace('_', ' ')}
                            </Badge>
                            <span>
                              Discovered: {new Date(opportunity.discoveredAt || Date.now()).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => window.open(opportunity.url, '_blank')}
                            className="gap-1"
                          >
                            <Globe className="h-3 w-3" />
                            Visit
                          </Button>
                          
                          <Button 
                            size="sm" 
                            onClick={() => handleContactClick(opportunity)}
                            className="gap-1"
                          >
                            <Mail className="h-3 w-3" />
                            Contact
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
        
        {/* Analytics Section */}
        {activeSection === 'analytics' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Performance Analytics</h3>
              <div className="flex space-x-2">
                <Button
                  variant={chartPeriod === "week" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setChartPeriod("week")}
                >
                  Week
                </Button>
                <Button
                  variant={chartPeriod === "month" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setChartPeriod("month")}
                >
                  Month
                </Button>
                <Button
                  variant={chartPeriod === "year" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setChartPeriod("year")}
                >
                  Year
                </Button>
              </div>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Domain Authority Distribution</CardTitle>
                <CardDescription>
                  Distribution of Domain Authority across your discovered opportunities
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {!analyticsData ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No analytics data available yet</p>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <BarChart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-xl font-medium">Analytics Coming Soon</h3>
                      <p className="text-muted-foreground mt-2">
                        We're building detailed analytics to help you track your outreach performance
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Contacted Section */}
        {activeSection === 'contacted' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold">Recently Contacted Opportunities</h3>
            
            {!recentContacts || recentContacts.length === 0 ? (
              <EmptyState
                title="No contacted opportunities yet"
                description="When you contact opportunity owners, they'll appear here for easy follow-up"
                icon={<Mail size={50} />}
                action={
                  <Button onClick={() => setActiveSection('opportunities')}>
                    Find Opportunities
                  </Button>
                }
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
          </div>
        )}
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
          
          <div className="space-y-4 py-4">
            {contactMutation.isPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : selectedOpportunity ? (
              <>
                {selectedOpportunity.contactInfo?.email && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Email:</h4>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={selectedOpportunity.contactInfo.email} 
                        readOnly 
                        className="font-mono" 
                      />
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          navigator.clipboard.writeText(selectedOpportunity.contactInfo.email);
                          toast({
                            title: "Copied to clipboard",
                            description: "Email address copied to clipboard"
                          });
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                )}
                
                {selectedOpportunity.contactInfo?.form && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Contact Form:</h4>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={selectedOpportunity.contactInfo.form} 
                        readOnly 
                        className="font-mono flex-1"
                      />
                      <Button 
                        size="sm" 
                        onClick={() => window.open(selectedOpportunity.contactInfo.form, '_blank')}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                )}
                
                {selectedOpportunity.contactInfo?.social && selectedOpportunity.contactInfo.social.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Social Profiles:</h4>
                    <div className="space-y-2">
                      {selectedOpportunity.contactInfo.social.map((social: string, index: number) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input 
                            value={social} 
                            readOnly 
                            className="font-mono flex-1"
                          />
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => window.open(social, '_blank')}
                          >
                            Open
                          </Button>
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
    </div>
  );
}