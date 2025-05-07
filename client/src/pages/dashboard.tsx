import Layout from "@/components/layout";
import OpportunityCard from "@/components/opportunity-card";
import EmailGenerator from "@/components/email-generator";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Link2, 
  PencilIcon, 
  PlusIcon, 
  Sparkles,
  Filter,
  SlidersHorizontal,
  LayoutGrid,
  List as ListIcon,
  Tag,
  CheckSquare,
  Eye,
  EyeOff,
  Star,
  Unlock,
  LightbulbIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Prospect, OutreachEmail } from "@shared/schema";

interface SiteSettings {
  id: number;
  name: string;
  url: string;
  niche: string;
  monthlyCredits: number;
  usedCredits: number;
  opportunities: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedTab, setSelectedTab] = useState("new");
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [daRange, setDaRange] = useState<[number, number]>([20, 80]);
  const [fitScoreRange, setFitScoreRange] = useState<[number, number]>([50, 100]);
  const [searchQuery, setSearchQuery] = useState("");
  const [hideFilters, setHideFilters] = useState(true);
  const [currentSite, setCurrentSite] = useState<SiteSettings | null>(null);
  const [sites, setSites] = useState<SiteSettings[]>([]);
  
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/stats");
      return await res.json();
    },
  });
  
  const { data: opportunities, isLoading: isLoadingOpportunities } = useQuery({
    queryKey: ["/api/prospects/daily"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/prospects/daily");
      return await res.json();
    },
  });
  
  // Simulate sites data based on user's subscription
  useEffect(() => {
    if (!user) return;
    
    const planSites: Record<string, SiteSettings[]> = {
      'Starter': [
        {
          id: 1,
          name: "My Blog",
          url: "myblog.com",
          niche: "Marketing",
          monthlyCredits: 50,
          usedCredits: 12,
          opportunities: 10
        }
      ],
      'Grow': [
        {
          id: 1,
          name: "My Blog",
          url: "myblog.com",
          niche: "Marketing",
          monthlyCredits: 75,
          usedCredits: 22,
          opportunities: 10
        },
        {
          id: 2,
          name: "My Shop",
          url: "myshop.com",
          niche: "E-commerce",
          monthlyCredits: 75,
          usedCredits: 15,
          opportunities: 10
        }
      ],
      'Pro': [
        {
          id: 1,
          name: "My Blog",
          url: "myblog.com",
          niche: "Marketing",
          monthlyCredits: 60,
          usedCredits: 18,
          opportunities: 10
        },
        {
          id: 2,
          name: "My Shop",
          url: "myshop.com",
          niche: "E-commerce",
          monthlyCredits: 60,
          usedCredits: 25,
          opportunities: 10
        },
        {
          id: 3,
          name: "My Agency",
          url: "myagency.com",
          niche: "Services",
          monthlyCredits: 60,
          usedCredits: 5,
          opportunities: 10
        },
        {
          id: 4,
          name: "My Podcast",
          url: "mypodcast.com",
          niche: "Entertainment",
          monthlyCredits: 60,
          usedCredits: 10,
          opportunities: 10
        },
        {
          id: 5,
          name: "My Portfolio",
          url: "myportfolio.com",
          niche: "Personal",
          monthlyCredits: 60,
          usedCredits: 2,
          opportunities: 10
        }
      ],
      'Free Trial': [
        {
          id: 1,
          name: "My Website",
          url: "mywebsite.com",
          niche: "Business",
          monthlyCredits: 10,
          usedCredits: 3,
          opportunities: 5
        }
      ]
    };
    
    const plan = user.subscription || 'Free Trial';
    const userSites = planSites[plan] || planSites['Free Trial'];
    
    setSites(userSites);
    if (userSites.length > 0 && !currentSite) {
      setCurrentSite(userSites[0]);
    }
  }, [user]);
  
  const bulkUnlockMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", `/api/prospects/bulk-unlock`, { ids });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setSelectedItems([]);
    }
  });
  
  const bulkStarMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", `/api/prospects/bulk-star`, { ids });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      setSelectedItems([]);
    }
  });
  
  const bulkHideMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", `/api/prospects/bulk-hide`, { ids });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      setSelectedItems([]);
    }
  });
  
  const handleEmailClick = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setEmailDialogOpen(true);
  };
  
  const handleItemSelect = (id: number, selected: boolean) => {
    if (selected) {
      setSelectedItems([...selectedItems, id]);
    } else {
      setSelectedItems(selectedItems.filter(itemId => itemId !== id));
    }
  };
  
  const handleBulkUnlock = () => {
    if (selectedItems.length === 0) return;
    bulkUnlockMutation.mutate(selectedItems);
  };
  
  const handleBulkStar = () => {
    if (selectedItems.length === 0) return;
    bulkStarMutation.mutate(selectedItems);
  };
  
  const handleBulkHide = () => {
    if (selectedItems.length === 0) return;
    bulkHideMutation.mutate(selectedItems);
  };
  
  const handleSiteChange = (site: SiteSettings) => {
    setCurrentSite(site);
  };
  
  const filterOpportunities = (opportunities: Prospect[] | undefined) => {
    if (!opportunities) return [];
    
    return opportunities.filter(opp => {
      // Filter by search query
      const searchMatch = searchQuery === "" || 
        opp.siteName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opp.niche.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opp.siteType.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Filter by DA range
      const daMatch = opp.domainAuthority >= daRange[0] && opp.domainAuthority <= daRange[1];
      
      // Filter by fit score range
      const fitMatch = opp.fitScore >= fitScoreRange[0] && opp.fitScore <= fitScoreRange[1];
      
      // Filter by tab
      const tabMatch = (
        (selectedTab === "new" && opp.isNew) ||
        (selectedTab === "earlier" && !opp.isNew) ||
        selectedTab === "all"
      );
      
      return searchMatch && daMatch && fitMatch && tabMatch;
    });
  };
  
  // Split opportunities into new and earlier
  const newOpportunities = opportunities?.filter(opp => opp.isNew) || [];
  const earlierOpportunities = opportunities?.filter(opp => !opp.isNew) || [];
  const filteredOpportunities = filterOpportunities(opportunities);
  
  const totalCredits = stats?.credits?.total || 0;
  const availableCredits = stats?.credits?.available || 0;
  
  return (
    <Layout>
      {/* Site summary bar */}
      {currentSite && (
        <div className="bg-white border-b border-gray-200 py-4 px-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <div className="flex items-center mb-4 md:mb-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="text-base font-medium mr-2">
                    <span className="mr-2">{currentSite.name}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuLabel>Select Website</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {sites.map(site => (
                    <DropdownMenuItem 
                      key={site.id} 
                      onClick={() => handleSiteChange(site)}
                      className={cn(
                        "cursor-pointer flex items-center py-2",
                        currentSite.id === site.id && "bg-primary-50 text-primary-700" 
                      )}
                    >
                      <div className="flex items-center w-full">
                        <div className="h-6 w-6 mr-2 rounded bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                          {site.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{site.url}</div>
                          <div className="text-xs text-gray-500">{site.niche}</div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/websites" className="cursor-pointer">
                      <div className="flex items-center text-primary-600">
                        <PlusIcon className="h-4 w-4 mr-2" />
                        <span>Add Website</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Badge variant="outline" className="bg-gray-50 mr-4">
                <Tag className="h-3 w-3 mr-1 text-gray-500" />
                {currentSite.niche}
              </Badge>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center">
                <span className="text-sm text-gray-500 mr-2">Credits this month:</span>
                <span className="text-sm font-medium">{currentSite.usedCredits} / {currentSite.monthlyCredits}</span>
              </div>
              
              <div className="flex items-center">
                <span className="text-sm text-gray-500 mr-2">Opportunities today:</span>
                <span className="text-sm font-medium">{currentSite.opportunities}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" className="h-8">
                  <PencilIcon className="h-3.5 w-3.5 mr-1.5" />
                  Edit Site
                </Button>
                <Button variant="outline" size="sm" className="h-8">
                  <PlusIcon className="h-3.5 w-3.5 mr-1.5" />
                  Add Site
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* AI insight banner */}
      <div className="bg-primary-50 border border-primary-100 rounded-lg p-4 mb-6 flex items-center">
        <LightbulbIcon className="h-5 w-5 text-primary-500 mr-2 flex-shrink-0" />
        <p className="text-sm text-primary-700">
          <strong>AI Insight:</strong> You have 3 high-quality guest post opportunities with DA 50+ that match your site content. Consider unlocking them first.
        </p>
      </div>
      
      {/* Opportunities feed */}
      <div>
        {/* Tabs and bulk actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center">
            <Tabs 
              defaultValue="new" 
              value={selectedTab}
              onValueChange={setSelectedTab}
              className="mr-4"
            >
              <TabsList>
                <TabsTrigger value="new" className="relative">
                  New Today
                  {newOpportunities.length > 0 && (
                    <Badge className="ml-1.5 py-0 h-5 min-w-5 absolute -right-1 -top-1 flex items-center justify-center">
                      {newOpportunities.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="earlier">Earlier</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
            
            {selectedItems.length > 0 && (
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleBulkUnlock}
                  disabled={bulkUnlockMutation.isPending}
                >
                  <Unlock className="h-4 w-4 mr-1.5" />
                  Unlock {selectedItems.length}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleBulkStar}
                  disabled={bulkStarMutation.isPending}
                >
                  <Star className="h-4 w-4 mr-1.5" />
                  Star {selectedItems.length}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleBulkHide}
                  disabled={bulkHideMutation.isPending}
                >
                  <EyeOff className="h-4 w-4 mr-1.5" />
                  Hide {selectedItems.length}
                </Button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <Input
                type="search"
                placeholder="Search opportunities"
                className="pl-9 h-9 w-48 md:w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9"
              onClick={() => setHideFilters(!hideFilters)}
            >
              <Filter className="h-4 w-4 mr-1.5" />
              Filters
            </Button>
            
            <div className="flex items-center border rounded overflow-hidden">
              <Button 
                variant={viewMode === "grid" ? "default" : "ghost"} 
                size="sm" 
                className={cn("h-9 rounded-none", viewMode === "grid" ? "bg-primary-100 text-primary-700 hover:bg-primary-200" : "")} 
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button 
                variant={viewMode === "list" ? "default" : "ghost"} 
                size="sm" 
                className={cn("h-9 rounded-none", viewMode === "list" ? "bg-primary-100 text-primary-700 hover:bg-primary-200" : "")}
                onClick={() => setViewMode("list")}
              >
                <ListIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Filters panel */}
        {!hideFilters && (
          <div className="bg-gray-50 border rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Domain Authority ({daRange[0]}-{daRange[1]})</label>
                <Slider
                  defaultValue={[20, 80]}
                  min={0}
                  max={100}
                  step={1}
                  value={daRange}
                  onValueChange={(value) => setDaRange(value as [number, number])}
                  className="py-4"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fit Score ({fitScoreRange[0]}-{fitScoreRange[1]}%)</label>
                <Slider
                  defaultValue={[50, 100]}
                  min={0}
                  max={100}
                  step={1}
                  value={fitScoreRange}
                  onValueChange={(value) => setFitScoreRange(value as [number, number])}
                  className="py-4"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categories</label>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="cursor-pointer bg-primary-50 text-primary-700 hover:bg-primary-100">
                    Guest Post
                  </Badge>
                  <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                    Resource Page
                  </Badge>
                  <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                    Directory
                  </Badge>
                  <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                    Blog Comment
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between mt-4 pt-4 border-t border-gray-200">
              <Button variant="outline" size="sm">
                Reset Filters
              </Button>
              <Button variant="outline" size="sm" className="text-primary-600">
                <SlidersHorizontal className="h-4 w-4 mr-1.5" />
                Save as Preset
              </Button>
            </div>
          </div>
        )}
        
        {/* Opportunity cards */}
        {isLoadingOpportunities ? (
          <div className={`grid ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"} gap-4`}>
            {Array(6).fill(0).map((_, i) => (
              <Card key={i} className={viewMode === "grid" ? "h-64" : "h-24"}>
                <div className="animate-pulse p-6 h-full flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="rounded-md bg-slate-200 h-10 w-10"></div>
                      <div>
                        <div className="h-4 w-20 bg-slate-200 rounded mb-2"></div>
                        <div className="h-3 w-16 bg-slate-200 rounded"></div>
                      </div>
                    </div>
                    <div className="h-6 w-16 bg-slate-200 rounded"></div>
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-full bg-slate-200 rounded"></div>
                    <div className="h-4 w-2/3 bg-slate-200 rounded"></div>
                  </div>
                  <div className="h-9 bg-slate-200 rounded mt-4"></div>
                </div>
              </Card>
            ))}
          </div>
        ) : filteredOpportunities.length > 0 ? (
          <div className={`grid ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"} gap-4`}>
            {filteredOpportunities.map((prospect: Prospect) => (
              <OpportunityCard 
                key={prospect.id} 
                prospect={prospect}
                onEmail={() => handleEmailClick(prospect)}
                onHide={() => console.log("Hide:", prospect.id)}
                isNew={prospect.isNew}
                selectable={true}
                selected={selectedItems.includes(prospect.id)}
                onSelectChange={(selected) => handleItemSelect(prospect.id, selected)}
                view={viewMode}
              />
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <CardContent>
              <p className="text-gray-500">No opportunities matching your filters. Try adjusting your criteria or check back tomorrow!</p>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Email dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Email Outreach</DialogTitle>
          </DialogHeader>
          {selectedProspect && (
            <EmailGenerator prospect={selectedProspect} />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
