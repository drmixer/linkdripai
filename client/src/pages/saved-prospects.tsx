import Layout from "@/components/layout";
import OpportunityCard from "@/components/opportunity-card";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Prospect } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EmailGenerator from "@/components/email-generator";
import { Search } from "lucide-react";

export default function SavedProspects() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("saved");
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const { data: savedProspects, isLoading: isSavedLoading } = useQuery({
    queryKey: ["/api/prospects/saved"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/prospects/saved");
      return await res.json();
    },
  });

  const { data: unlockedProspects, isLoading: isUnlockedLoading } = useQuery({
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

  const filteredSavedProspects = savedProspects
    ? savedProspects.filter((prospect: Prospect) =>
        searchTerm
          ? prospect.siteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            prospect.siteType.toLowerCase().includes(searchTerm.toLowerCase()) ||
            prospect.niche.toLowerCase().includes(searchTerm.toLowerCase())
          : true
      )
    : [];

  const filteredUnlockedProspects = unlockedProspects
    ? unlockedProspects.filter((prospect: Prospect) =>
        searchTerm
          ? prospect.siteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            prospect.siteType.toLowerCase().includes(searchTerm.toLowerCase()) ||
            prospect.niche.toLowerCase().includes(searchTerm.toLowerCase())
          : true
      )
    : [];

  return (
    <Layout title="Saved Prospects">
      <div className="flex items-center justify-between mb-6">
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <Input
            type="search"
            placeholder="Search saved prospects..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="saved">Saved</TabsTrigger>
          <TabsTrigger value="unlocked">Unlocked History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="saved" className="mt-6">
          {isSavedLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array(6).fill(0).map((_, i) => (
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
          ) : filteredSavedProspects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSavedProspects.map((prospect: Prospect) => (
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
                <p className="text-gray-500">
                  No saved prospects found. When you find interesting opportunities, save them for later.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="unlocked" className="mt-6">
          {isUnlockedLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array(6).fill(0).map((_, i) => (
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
          ) : filteredUnlockedProspects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUnlockedProspects.map((prospect: Prospect) => (
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
                <p className="text-gray-500">
                  No unlocked prospects found. Unlock prospects to view full details and contact information.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

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
