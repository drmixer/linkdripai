import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import OpportunityCard from '@/components/opportunity-card';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Loader2, Filter, RefreshCw, Sparkles, Info } from 'lucide-react';
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
  
  // Get premium splash
  const splashMutation = useMutation({
    mutationFn: async (websiteId: number) => {
      const response = await apiRequest('POST', '/api/opportunities/splash', { websiteId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Splash used successfully!",
        description: "A premium opportunity has been added to your list",
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
  
  // Loading state
  if (loadingWebsites || loadingPlan || loadingOpportunities) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={40} className="animate-spin mb-4 text-primary" />
        <h3 className="text-xl font-medium">Loading opportunities...</h3>
        <p className="text-muted-foreground">We're preparing your personalized opportunities</p>
      </div>
    );
  }
  
  // Empty state
  if (!opportunities || opportunities.length === 0) {
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
    <div className="container py-8 max-w-7xl">
      <div className="flex flex-col gap-6">
        {/* Header section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Unlocked Opportunities</h1>
            <p className="text-muted-foreground mt-1">
              All opportunities are fully unlocked - explore and reach out to the best matches for your websites.
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter size={16} />
              Filters
              {Object.keys(activeFilters).length > 0 && (
                <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                  {Object.keys(activeFilters).length}
                </Badge>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              className="gap-2"
            >
              <RefreshCw size={16} />
              Refresh
            </Button>
          </div>
        </div>
        
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-bold">{stats.total}</CardTitle>
              <CardDescription>Total Opportunities</CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-bold">{stats.premium}</CardTitle>
              <CardDescription>Premium Opportunities</CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-bold">{stats.today}</CardTitle>
              <CardDescription>New Today</CardDescription>
            </CardHeader>
          </Card>
        </div>
        
        {/* Splash premium section */}
        <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="text-purple-500" size={20} />
              Premium Splash
            </CardTitle>
            <CardDescription>
              Use a Splash to instantly discover a premium high-quality opportunity (DA 40+, spam score &lt;2) with 80%+ relevance to your website.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="flex-grow">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">Remaining Splashes:</span>
                  <Badge variant="outline" className="bg-purple-100">
                    {userPlan?.remainingSplashes || 0} / {userPlan?.totalSplashes || 0}
                  </Badge>
                </div>
                <Progress 
                  value={userPlan ? (userPlan.remainingSplashes / userPlan.totalSplashes) * 100 : 0} 
                  className="h-2" 
                />
              </div>
              
              <div className="flex gap-2">
                {userPlan?.remainingSplashes > 0 ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                        <Sparkles size={16} />
                        Use a Splash
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Use Premium Splash?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will use 1 Splash credit to discover a premium opportunity with DA 40+ and high relevance to your website.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleUseSplash(
                            websites && websites.length > 0 
                              ? parseInt(websiteFilter === 'all' ? websites[0].id : websiteFilter) 
                              : 0
                          )}
                          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                        >
                          Use Splash
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button 
                    className="gap-2 bg-purple-600 hover:bg-purple-700" 
                    onClick={() => window.location.href = '/pricing'}
                  >
                    <Sparkles size={16} />
                    Get More Splashes
                  </Button>
                )}
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Info size={16} />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>About Premium Splash</DialogTitle>
                      <DialogDescription>
                        Premium Splash delivers carefully vetted high-quality opportunities with these characteristics:
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <h4 className="font-medium">Premium Quality Thresholds:</h4>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                          <li>Domain Authority: 40+</li>
                          <li>Spam Score: Less than 2</li>
                          <li>Content Relevance: 80%+</li>
                          <li>Valid Contact Methods Available</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium">Benefits:</h4>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                          <li>Higher success rate for backlink outreach</li>
                          <li>More valuable for your SEO strategy</li>
                          <li>Thoroughly vetted for quality and relevance</li>
                        </ul>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
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
        
        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          Showing {filteredOpportunities.length} of {opportunities.length} opportunities
        </div>
        
        {/* Opportunities grid */}
        {filteredOpportunities.length === 0 ? (
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
        ) : (
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
        )}
      </div>
      
      {/* Contact Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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