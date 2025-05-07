import Layout from "@/components/layout";
import OutreachTable from "@/components/outreach-table";
import EmailGenerator from "@/components/email-generator";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Prospect, OutreachEmail } from "@shared/schema";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Search, Filter } from "lucide-react";

export default function EmailOutreach() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<OutreachEmail | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailViewDialogOpen, setEmailViewDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  const { data: emails, isLoading } = useQuery({
    queryKey: ["/api/emails"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/emails");
      return await res.json();
    },
  });

  const { data: unlockedProspects, isLoading: isProspectsLoading } = useQuery({
    queryKey: ["/api/prospects/unlocked"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/prospects/unlocked");
      return await res.json();
    },
  });

  const handleNewEmail = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setEmailDialogOpen(true);
  };

  const handleViewEmail = (email: OutreachEmail) => {
    setSelectedEmail(email);
    setEmailViewDialogOpen(true);
  };

  const getFilteredEmails = () => {
    if (!emails) return [];

    return emails.filter((email: OutreachEmail) => {
      // Filter by search term
      if (
        searchTerm &&
        !(
          email.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          email.contactEmail.toLowerCase().includes(searchTerm.toLowerCase())
        )
      ) {
        return false;
      }

      // Filter by status
      if (statusFilter !== "all" && email.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // Filter by tab
      if (activeTab === "awaiting" && email.status.toLowerCase() !== "awaiting response") {
        return false;
      }
      if (activeTab === "responded" && email.status.toLowerCase() !== "responded") {
        return false;
      }
      if (activeTab === "no-response" && email.status.toLowerCase() !== "no response") {
        return false;
      }

      return true;
    });
  };

  return (
    <Layout title="Email Outreach">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <Input
            type="search"
            placeholder="Search by site or email..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="awaiting response">Awaiting Response</SelectItem>
              <SelectItem value="responded">Responded</SelectItem>
              <SelectItem value="no response">No Response</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="whitespace-nowrap">
            <Filter className="h-4 w-4 mr-2" />
            New Email
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="awaiting">Awaiting</TabsTrigger>
          <TabsTrigger value="responded">Responded</TabsTrigger>
          <TabsTrigger value="no-response">No Response</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <Card className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded"></div>
            <div className="space-y-2">
              <div className="h-12 bg-slate-200 rounded"></div>
              <div className="h-12 bg-slate-200 rounded"></div>
              <div className="h-12 bg-slate-200 rounded"></div>
            </div>
          </div>
        </Card>
      ) : emails && getFilteredEmails().length > 0 ? (
        <OutreachTable 
          emails={getFilteredEmails()} 
          onViewEmail={handleViewEmail} 
        />
      ) : (
        <Card className="p-8">
          <CardContent className="text-center pt-6">
            <p className="text-gray-500">
              No emails match your current filters. Try adjusting your search or start a new outreach.
            </p>
          </CardContent>
        </Card>
      )}

      {/* New Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>New Email Outreach</DialogTitle>
          </DialogHeader>
          {selectedProspect && (
            <EmailGenerator prospect={selectedProspect} />
          )}
        </DialogContent>
      </Dialog>

      {/* View Email Dialog */}
      <Dialog open={emailViewDialogOpen} onOpenChange={setEmailViewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700">To:</h3>
                <p>{selectedEmail.contactEmail}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700">Subject:</h3>
                <p>{selectedEmail.subject}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700">Sent:</h3>
                <p>{new Date(selectedEmail.sentAt).toLocaleString()}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700">Status:</h3>
                <p>{selectedEmail.status}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700">Message:</h3>
                <div className="p-4 bg-gray-50 rounded-md whitespace-pre-wrap">
                  {selectedEmail.body}
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEmailViewDialogOpen(false)}>
                  Close
                </Button>
                {selectedEmail.status !== "Responded" && (
                  <Button>Follow Up</Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
