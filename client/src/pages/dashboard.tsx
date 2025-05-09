import Layout from "@/components/layout";
import OpportunityCard from "@/components/opportunity-card";
import EmailGenerator from "@/components/email-generator";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
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
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  ChevronDown, 
  Search, 
  Filter,
  SlidersHorizontal,
  LayoutGrid,
  List as ListIcon,
  EyeOff,
  Sparkles,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Prospect } from "@shared/schema";
import { SimpleCheckbox } from "@/components/simple-checkbox";

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
  const [location] = useLocation();
  const { toast } = useToast();
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedTab, setSelectedTab] = useState("new");
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [daRange, setDaRange] = useState<[number, number]>([20, 80]);
  const [fitScoreRange, setFitScoreRange] = useState<[number, number]>([50, 100]);
  const [searchQuery, setSearchQuery] = useState("");
  const [hideFilters, setHideFilters] = useState(true);
  
  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/stats");
      return await res.json();
    },
  });
  
  // Fetch opportunities
  const { data: opportunities, isLoading: isLoadingOpportunities } = useQuery({
    queryKey: ["/api/prospects/daily"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/prospects/daily");
      return await res.json();
    },
  });
  
  // Bulk unlock mutation
  const bulkUnlockMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", `/api/prospects/bulk-unlock`, { ids });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prospects/daily"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Prospects unlocked",
        description: `Successfully unlocked ${selectedItems.length} prospect${selectedItems.length > 1 ? 's' : ''}.`,
      });
      setSelectedItems([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to unlock prospects",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Bulk hide mutation
  const bulkHideMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", `/api/prospects/bulk-hide`, { ids });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prospects/daily"] });
      toast({
        title: "Prospects hidden",
        description: `Successfully hid ${selectedItems.length} prospect${selectedItems.length > 1 ? 's' : ''}.`,
      });
      setSelectedItems([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to hide prospects",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const handleEmailClick = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setEmailDialogOpen(true);
  };
  
  const handleItemSelect = (id: number, selected: boolean) => {
    if (selected) {
      // Add the item to the selected items if it's not already there
      if (!selectedItems.includes(id)) {
        setSelectedItems([...selectedItems, id]);
      }
    } else {
      // Remove the item from selected items
      setSelectedItems(selectedItems.filter(itemId => itemId !== id));
    }
  };
  
  const handleBulkUnlock = () => {
    if (selectedItems.length === 0) return;
    bulkUnlockMutation.mutate(selectedItems);
  };
  
  const handleBulkHide = () => {
    if (selectedItems.length === 0) return;
    bulkHideMutation.mutate(selectedItems);
  };
  
  const filterOpportunities = (opportunities: Prospect[] | undefined) => {
    if (!opportunities) return [];
    
    // Filter the opportunities first
    const filtered = opportunities.filter(opp => {
      // Filter out unlocked opportunities - these belong in Unlocked Opportunities section
      if (opp.isUnlocked) return false;
      
      // Filter by hidden state
      if (selectedTab !== "hidden" && opp.isHidden) return false;
      if (selectedTab === "hidden" && !opp.isHidden) return false;
      
      // Filter by search query
      const searchMatch = searchQuery === "" || 
        (opp.siteName && opp.siteName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (opp.domain && opp.domain.toLowerCase().includes(searchQuery.toLowerCase())) ||
        opp.niche.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Filter by DA range
      const daValue = parseInt(opp.domainAuthority);
      const daMatch = !isNaN(daValue) && daValue >= daRange[0] && daValue <= daRange[1];
      
      // Filter by fit score range
      const fitMatch = opp.fitScore >= fitScoreRange[0] && opp.fitScore <= fitScoreRange[1];
      
      // Filter by tab if not 'hidden'
      const tabMatch = selectedTab === "hidden" || (
        (selectedTab === "new" && (opp.isNew ?? true)) ||
        (selectedTab === "earlier" && !(opp.isNew ?? true)) ||
        selectedTab === "all"
      );
      
      return searchMatch && daMatch && fitMatch && tabMatch;
    });
    
    // Sort opportunities with newest at the top
    return filtered.sort((a: Prospect, b: Prospect) => b.id - a.id);
  };
  
  const filteredOpportunities = filterOpportunities(opportunities);
  const totalCredits = stats?.credits?.total || 0;
  const availableCredits = stats?.credits?.available || user?.credits || 0;

  return (
    <Layout title="Daily Link Opportunities">
      <div className="mb-2 text-sm text-gray-600">
        Here are your latest curated backlink prospects.
      </div>
      
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        {/* Credits */}
        <div className="flex items-center">
          <div className="text-sm mr-6">
            <span className="text-gray-500">Credits: </span>
            <span className="font-medium">{availableCredits}</span>
          </div>
          
          <Button 
            variant="link" 
            className="h-auto p-0 text-sm"
            onClick={() => {
              // Toggle hidden opportunities view
              setSelectedTab(selectedTab === "hidden" ? "new" : "hidden");
            }}
          >
            {selectedTab === "hidden" ? "Hide Hidden" : `Show Hidden (${opportunities?.filter((o: Prospect) => o.isHidden).length || 0})`}
          </Button>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Niche dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                All Niches
                <ChevronDown className="h-4 w-4 ml-2 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="cursor-pointer">All Niches</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">Marketing</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">SaaS</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">E-commerce</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">Technology</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">Finance</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* More filters button */}
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9"
            onClick={() => setHideFilters(!hideFilters)}
          >
            <Filter className="h-4 w-4 mr-1.5" />
            More Filters
          </Button>
          
          {/* Search */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by URL, niche, or description..."
              className="pl-9 h-9 w-[260px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5 absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {/* View mode toggle */}
          <div className="flex border rounded-md overflow-hidden">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setViewMode("grid")}
              className={cn(
                "h-9 rounded-none px-2",
                viewMode === "grid" ? "bg-gray-100" : "bg-transparent"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setViewMode("list")}
              className={cn(
                "h-9 rounded-none px-2",
                viewMode === "list" ? "bg-gray-100" : "bg-transparent"
              )}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Bulk actions */}
      {selectedItems.length > 0 && (
        <div className="bg-gray-50 border rounded-lg p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center">
            <SimpleCheckbox
              checked={selectedItems.length === filteredOpportunities.length && filteredOpportunities.length > 0}
              onChange={(checked) => {
                if (checked) {
                  // Select all visible opportunities
                  setSelectedItems(filteredOpportunities.map(opp => opp.id));
                } else {
                  // Deselect all
                  setSelectedItems([]);
                }
              }}
              className="mr-2"
            />
            <span className="text-sm font-medium">{selectedItems.length} items selected</span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleBulkUnlock}
              disabled={bulkUnlockMutation.isPending}
              className="h-8"
            >
              Unlock
              <span className="ml-1 text-xs text-gray-500">{selectedItems.length} cr</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleBulkHide}
              disabled={bulkHideMutation.isPending}
              className="h-8"
            >
              <EyeOff className="h-3.5 w-3.5 mr-1" />
              Hide
            </Button>
          </div>
        </div>
      )}
      
      {/* Filters panel */}
      {!hideFilters && (
        <div className="bg-gray-50 border rounded-lg p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setDaRange([20, 80]);
                setFitScoreRange([50, 100]);
                setSearchQuery("");
              }}
            >
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
        <div className={viewMode === "grid" 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          : "flex flex-col space-y-3"
        }>
          {filteredOpportunities.map((prospect: Prospect) => (
            <OpportunityCard 
              key={prospect.id} 
              prospect={prospect}
              onEmail={() => handleEmailClick(prospect)}
              onHide={() => {
                // Remove this prospect from the filtered list after hiding
                queryClient.invalidateQueries({ queryKey: ["/api/prospects/daily"] });
              }}
              isNew={prospect.isNew ?? true}
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
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
              <Sparkles className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No opportunities found</h3>
            <p className="text-gray-500 mb-4">
              No opportunities matching your current filters. Try adjusting your filters or check back tomorrow.
            </p>
            <Button 
              onClick={() => {
                setSearchQuery("");
                setDaRange([20, 80]);
                setFitScoreRange([50, 100]);
                setSelectedTab("new");
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}
      
      {/* Email dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden max-h-[90vh]">
          <DialogHeader className="p-4 pb-2 flex flex-row justify-between items-center border-b">
            <DialogTitle>Email Outreach</DialogTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setEmailDialogOpen(false)}
              className="h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
            {selectedProspect && (
              <EmailGenerator 
                prospect={selectedProspect}
                onClose={() => setEmailDialogOpen(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}