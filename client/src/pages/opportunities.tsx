import Layout from "@/components/layout";
import OpportunityCard from "@/components/opportunity-card";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Prospect } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EmailGenerator from "@/components/email-generator";
import { Search, SlidersHorizontal } from "lucide-react";

export default function Opportunities() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    nicheFilter: "all",
    daRangeFilter: "all",
    typeFilter: "all",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const { data: opportunities, isLoading } = useQuery({
    queryKey: ["/api/prospects/unlocked"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/prospects/unlocked");
      return await res.json();
    },
  });

  const handleEmailClick = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setEmailDialogOpen(true);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const filteredOpportunities = opportunities
    ? opportunities.filter((prospect: Prospect) => {
        // Search term filter
        if (
          searchTerm &&
          !(
            prospect.siteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            prospect.siteType.toLowerCase().includes(searchTerm.toLowerCase()) ||
            prospect.niche.toLowerCase().includes(searchTerm.toLowerCase())
          )
        ) {
          return false;
        }

        // Niche filter
        if (filters.nicheFilter !== "all" && prospect.niche !== filters.nicheFilter) {
          return false;
        }

        // DA Range filter
        if (filters.daRangeFilter !== "all") {
          const da = typeof prospect.domainAuthority === 'string' 
            ? parseInt(prospect.domainAuthority.split('-')[0]) 
            : prospect.domainAuthority;
          
          if (filters.daRangeFilter === "0-30" && da > 30) return false;
          if (filters.daRangeFilter === "31-50" && (da < 31 || da > 50)) return false;
          if (filters.daRangeFilter === "51-70" && (da < 51 || da > 70)) return false;
          if (filters.daRangeFilter === "71+" && da < 71) return false;
        }

        // Type filter
        if (filters.typeFilter !== "all" && prospect.siteType !== filters.typeFilter) {
          return false;
        }

        return true;
      })
    : [];

  return (
    <Layout title="Unlocked Opportunities">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 space-y-4 md:space-y-0">
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <Input
            type="search"
            placeholder="Search by name, type, or niche..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center"
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          {showFilters ? "Hide Filters" : "Show Filters"}
        </Button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Niche</label>
            <Select
              value={filters.nicheFilter}
              onValueChange={(value) => handleFilterChange("nicheFilter", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select niche" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Niches</SelectItem>
                <SelectItem value="Digital Marketing">Digital Marketing</SelectItem>
                <SelectItem value="SEO">SEO</SelectItem>
                <SelectItem value="Content">Content</SelectItem>
                <SelectItem value="Web Dev">Web Development</SelectItem>
                <SelectItem value="Programming">Programming</SelectItem>
                <SelectItem value="Business">Business</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Domain Authority</label>
            <Select
              value={filters.daRangeFilter}
              onValueChange={(value) => handleFilterChange("daRangeFilter", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select DA range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All DA Ranges</SelectItem>
                <SelectItem value="0-30">0-30</SelectItem>
                <SelectItem value="31-50">31-50</SelectItem>
                <SelectItem value="51-70">51-70</SelectItem>
                <SelectItem value="71+">71+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Site Type</label>
            <Select
              value={filters.typeFilter}
              onValueChange={(value) => handleFilterChange("typeFilter", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select site type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Blog with guest posting">Blog with guest posting</SelectItem>
                <SelectItem value="Premium blog">Premium blog</SelectItem>
                <SelectItem value="Tutorial site">Tutorial site</SelectItem>
                <SelectItem value="News site">News site</SelectItem>
                <SelectItem value="Resource directory">Resource directory</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(9).fill(0).map((_, i) => (
            <Card key={i} className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="flex space-x-4">
                  <div className="rounded-full bg-slate-200 h-10 w-10"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded"></div>
                    <div className="h-3 bg-slate-200 rounded"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-200 rounded"></div>
                  <div className="h-3 bg-slate-200 rounded"></div>
                  <div className="h-3 bg-slate-200 rounded"></div>
                </div>
                <div className="h-8 bg-slate-200 rounded"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredOpportunities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOpportunities.map((prospect: Prospect) => (
            <OpportunityCard
              key={prospect.id}
              prospect={prospect}
              onEmail={() => handleEmailClick(prospect)}
            />
          ))}
        </div>
      ) : (
        <Card className="p-8">
          <CardContent className="text-center pt-6">
            <p className="text-gray-500">No opportunities match your filters. Try adjusting your search criteria.</p>
          </CardContent>
        </Card>
      )}

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
