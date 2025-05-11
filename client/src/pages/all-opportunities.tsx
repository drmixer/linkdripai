import React, { useState } from 'react';
import Layout from '@/components/layout';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger
} from '@/components/ui/tabs';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  Star, 
  ListFilter, 
  FileText,
  Bookmark
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Prospect } from '@shared/schema';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AllOpportunitiesPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTab, setCurrentTab] = useState('all');
  const [sortBy, setSortBy] = useState('relevance');
  const [domainAuthorityFilter, setDomainAuthorityFilter] = useState('all');
  const [relevanceFilter, setRelevanceFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch all opportunities
  const { data: allOpportunities, isLoading } = useQuery({
    queryKey: ['/api/opportunities/all'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/opportunities/all');
      return await res.json();
    },
    refetchOnWindowFocus: false,
  });

  // Filter opportunities based on search query and filters
  const filteredOpportunities = allOpportunities ? allOpportunities.filter((opp: any) => {
    // Search filter
    if (searchQuery && !opp.websiteName.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !opp.websiteUrl.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Domain Authority filter
    if (domainAuthorityFilter !== 'all') {
      const daMin = parseInt(domainAuthorityFilter.split('-')[0]);
      const daMax = parseInt(domainAuthorityFilter.split('-')[1] || '100');
      if (opp.domainAuthority < daMin || opp.domainAuthority > daMax) {
        return false;
      }
    }
    
    // Relevance filter
    if (relevanceFilter !== 'all') {
      const relMin = parseInt(relevanceFilter.split('-')[0]);
      const relMax = parseInt(relevanceFilter.split('-')[1] || '100');
      if (opp.relevanceScore < relMin || opp.relevanceScore > relMax) {
        return false;
      }
    }
    
    return true;
  }) : [];
  
  // Sort opportunities
  const sortedOpportunities = filteredOpportunities ? [...filteredOpportunities].sort((a: any, b: any) => {
    if (sortBy === 'relevance') {
      return b.relevanceScore - a.relevanceScore;
    } else if (sortBy === 'domainAuthority') {
      return b.domainAuthority - a.domainAuthority;
    } else if (sortBy === 'date') {
      return new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime();
    }
    return 0;
  }) : [];

  // Get saved opportunities
  const savedOppIds = allOpportunities
    ? allOpportunities.filter((opp: any) => opp.isSaved).map((opp: any) => opp.id)
    : [];

  return (
    <Layout title="All Opportunities">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Opportunities</h1>
          <p className="text-muted-foreground">
            View and manage all available backlink opportunities for your websites
          </p>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search opportunities..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <div className="flex items-center">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                <span>Sort by</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="domainAuthority">Domain Authority</SelectItem>
              <SelectItem value="date">Date Added</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(showFilters && "bg-primary-50 text-primary-700 border-primary-200")}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>
      
      {showFilters && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <ListFilter className="mr-2 h-5 w-5" />
              Advanced Filters
            </CardTitle>
            <CardDescription>
              Filter opportunities based on specific criteria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Domain Authority</label>
                <Select value={domainAuthorityFilter} onValueChange={setDomainAuthorityFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="0-10">0-10</SelectItem>
                    <SelectItem value="10-20">10-20</SelectItem>
                    <SelectItem value="20-30">20-30</SelectItem>
                    <SelectItem value="30-40">30-40</SelectItem>
                    <SelectItem value="40-50">40-50</SelectItem>
                    <SelectItem value="50-60">50-60</SelectItem>
                    <SelectItem value="60-100">60+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Relevance Score</label>
                <Select value={relevanceFilter} onValueChange={setRelevanceFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="0-50">Less than 50%</SelectItem>
                    <SelectItem value="50-70">50-70%</SelectItem>
                    <SelectItem value="70-80">70-80%</SelectItem>
                    <SelectItem value="80-90">80-90%</SelectItem>
                    <SelectItem value="90-100">90-100%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDomainAuthorityFilter('all');
                    setRelevanceFilter('all');
                  }}
                >
                  Reset Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Tabs value={currentTab} onValueChange={setCurrentTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">All Opportunities</TabsTrigger>
          <TabsTrigger value="saved">
            Saved
            {savedOppIds.length > 0 && (
              <span className="ml-2 text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">
                {savedOppIds.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="premium">Premium</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center p-12">
              <div className="flex flex-col items-center">
                <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
                <p className="text-muted-foreground">Loading opportunities...</p>
              </div>
            </div>
          ) : sortedOpportunities.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No opportunities found</h3>
                <p className="text-muted-foreground mb-6">
                  {searchQuery || domainAuthorityFilter !== 'all' || relevanceFilter !== 'all'
                    ? "No opportunities match your current filters. Try adjusting your search criteria."
                    : "No opportunities have been discovered yet for your website. Check back later!"}
                </p>
                {(searchQuery || domainAuthorityFilter !== 'all' || relevanceFilter !== 'all') && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('');
                      setDomainAuthorityFilter('all');
                      setRelevanceFilter('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedOpportunities.map((opp: any) => (
                <OpportunityCard key={opp.id} opportunity={opp} isSaved={savedOppIds.includes(opp.id)} />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="saved" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center p-12">
              <div className="flex flex-col items-center">
                <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
                <p className="text-muted-foreground">Loading saved opportunities...</p>
              </div>
            </div>
          ) : savedOppIds.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Bookmark className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No saved opportunities</h3>
                <p className="text-muted-foreground mb-6">
                  You haven't saved any opportunities yet. Save opportunities to reference them later.
                </p>
                <Button variant="default" onClick={() => setCurrentTab('all')}>
                  Browse Opportunities
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedOpportunities
                .filter((opp: any) => savedOppIds.includes(opp.id))
                .map((opp: any) => (
                  <OpportunityCard 
                    key={opp.id} 
                    opportunity={opp} 
                    isSaved={true} 
                  />
                ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="premium" className="space-y-4">
          <Card>
            <CardContent className="p-8 text-center">
              <Star className="h-12 w-12 mx-auto text-amber-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">Premium Opportunities</h3>
              <p className="text-muted-foreground mb-6">
                Premium opportunities have a Domain Authority of 40+, relevance score of 80%+, and spam score below 2%.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedOpportunities
                  .filter((opp: any) => 
                    opp.domainAuthority >= 40 && 
                    opp.relevanceScore >= 80 && 
                    opp.spamScore < 2
                  )
                  .map((opp: any) => (
                    <OpportunityCard 
                      key={opp.id} 
                      opportunity={opp} 
                      isSaved={savedOppIds.includes(opp.id)}
                      isPremium={true}
                    />
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}

// Opportunity Card Component
function OpportunityCard({ 
  opportunity, 
  isSaved = false,
  isPremium = false,
}: { 
  opportunity: any; 
  isSaved?: boolean;
  isPremium?: boolean; 
}) {
  const getDAColor = (da: number) => {
    if (da >= 50) return "text-green-600";
    if (da >= 30) return "text-amber-600";
    return "text-gray-600";
  };
  
  const getRelevanceColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-gray-600";
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }).format(date);
  };

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-200", 
      isPremium && "border-amber-300 shadow-md"
    )}>
      {isPremium && (
        <div className="bg-amber-400 text-white px-3 py-1 text-xs font-medium text-center">
          Premium Opportunity
        </div>
      )}
      <CardHeader className="p-4 pb-0">
        <div className="flex justify-between items-start">
          <div className="space-y-1.5">
            <CardTitle className="text-base font-semibold line-clamp-1">
              {opportunity.websiteName}
            </CardTitle>
            <CardDescription className="line-clamp-1">
              <a href={opportunity.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {opportunity.websiteUrl}
              </a>
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" className={cn(
            "h-8 w-8 rounded-full", 
            isSaved && "text-amber-500"
          )}>
            <Star className="h-5 w-5" fill={isSaved ? "currentColor" : "none"} />
            <span className="sr-only">{isSaved ? "Unsave" : "Save"}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Domain Authority</p>
            <p className={cn("text-sm font-medium", getDAColor(opportunity.domainAuthority))}>
              {opportunity.domainAuthority}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Relevance</p>
            <p className={cn("text-sm font-medium", getRelevanceColor(opportunity.relevanceScore))}>
              {opportunity.relevanceScore}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Spam Score</p>
            <p className="text-sm font-medium">
              {opportunity.spamScore < 2 ? (
                <span className="text-green-600">{opportunity.spamScore}%</span>
              ) : opportunity.spamScore < 5 ? (
                <span className="text-amber-600">{opportunity.spamScore}%</span>
              ) : (
                <span className="text-red-600">{opportunity.spamScore}%</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Discovered</p>
            <p className="text-sm font-medium">
              {formatDate(opportunity.discoveredAt)}
            </p>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Content Match</span>
            <span className="font-medium">{opportunity.contentMatchScore}%</span>
          </div>
          <Progress value={opportunity.contentMatchScore} className="h-1" />
        </div>
        
        <div className="flex gap-2 mt-4">
          <Button className="flex-1" size="sm">
            View Details
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="px-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Create Email</DropdownMenuItem>
              <DropdownMenuItem>Hide</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}