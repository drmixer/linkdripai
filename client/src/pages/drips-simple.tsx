import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '@/components/layout';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  Search, 
  RefreshCw,
  Globe
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import DripOpportunityCard from '@/components/drip-opportunity-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function DripsSimplePage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [websiteFilter, setWebsiteFilter] = useState('all');
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);
  
  // Handle contact info view
  const handleContactClick = (opportunity: any) => {
    setSelectedOpportunity(opportunity);
    // In a real implementation, this would open a modal with contact info
    console.log("Contact info requested for:", opportunity.domain);
  };
  
  // Get user websites
  const { data: websites = [] } = useQuery<any[]>({
    queryKey: ['/api/websites'],
    enabled: !!user
  });
  
  // Get opportunities
  const { data: opportunities = [], isLoading: loadingOpportunities, refetch } = useQuery<any[]>({
    queryKey: ['/api/drips/opportunities'],
    enabled: !!user
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
    
    return filtered;
  }, [opportunities, websiteFilter, searchQuery]);
  
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
            
            <Button 
              variant="outline" 
              onClick={() => refetch()}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingOpportunities ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
        
        {/* Opportunities list */}
        {loadingOpportunities ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading opportunities...</p>
            </div>
          </div>
        ) : filteredOpportunities.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-lg font-medium mb-2">No opportunities found</p>
              <p className="text-muted-foreground text-center max-w-md">
                {searchQuery ? "Try adjusting your search to see more results." : "No opportunities found for your website yet. Check back later or add more websites."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOpportunities.map((opportunity: any) => (
              <DripOpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                websiteId={websiteFilter === 'all' ? opportunity.matchedWebsiteId : parseInt(websiteFilter)}
                onContactClick={handleContactClick}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}