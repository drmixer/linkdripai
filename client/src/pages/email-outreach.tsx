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
  const [showEmailSetupModal, setShowEmailSetupModal] = useState(false);

  // Check if email is set up
  const { data: emailSettings, isLoading: isEmailSettingsLoading } = useQuery({
    queryKey: ["/api/email/settings"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/email/settings");
        return await res.json();
      } catch (error) {
        // If API doesn't exist yet, return default state
        return { isConfigured: false };
      }
    },
  });

  const { data: emails, isLoading } = useQuery({
    queryKey: ["/api/emails"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/emails");
      return await res.json();
    },
  });

  const { data: prospects, isLoading: isProspectsLoading } = useQuery({
    queryKey: ["/api/prospects/contacts"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/prospects/contacts");
        return await res.json();
      } catch (error) {
        // Fallback to unlocked prospects if the contacts endpoint isn't implemented yet
        const res = await apiRequest("GET", "/api/prospects/unlocked");
        return await res.json();
      }
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
          (email.siteName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
          (email.contactEmail?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
        )
      ) {
        return false;
      }

      // Filter by status
      if (statusFilter !== "all" && email.status?.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // Filter by tab
      if (activeTab === "sent" && email.status?.toLowerCase() !== "sent") {
        return false;
      }
      if (activeTab === "needs-followup" && 
          (email.status?.toLowerCase() !== "awaiting response" && 
           email.status?.toLowerCase() !== "no response")) {
        return false;
      }
      if (activeTab === "responded" && email.status?.toLowerCase() !== "responded") {
        return false;
      }
      if (activeTab === "completed" && email.status?.toLowerCase() !== "completed") {
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
        <TabsList className="grid w-full max-w-md grid-cols-5">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="needs-followup">Needs Followup</TabsTrigger>
          <TabsTrigger value="responded">Replied</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
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
                <p>{selectedEmail.sentAt ? new Date(selectedEmail.sentAt).toLocaleString() : 'Not sent yet'}</p>
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
      
      {/* Email Setup Modal */}
      <Dialog open={showEmailSetupModal || (!isEmailSettingsLoading && emailSettings && !emailSettings.isConfigured)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Email Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Set Up Email Integration</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Configure your email settings to start sending outreach emails directly from LinkDripAI.
              </p>
            </div>
            
            <div className="grid gap-4">
              <div>
                <label className="text-sm font-medium block mb-1">Email Integration Method</label>
                <Select defaultValue="sendgrid">
                  <SelectTrigger>
                    <SelectValue placeholder="Select email method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sendgrid">SendGrid API</SelectItem>
                    <SelectItem value="smtp">SMTP Server</SelectItem>
                    <SelectItem value="gmail">Gmail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium block mb-1">From Email Address</label>
                <Input placeholder="your@email.com" />
                <p className="text-xs text-muted-foreground mt-1">
                  This email address will be shown as the sender of your outreach emails.
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium block mb-1">API Key</label>
                <Input type="password" placeholder="Your SendGrid API Key" />
                <p className="text-xs text-muted-foreground mt-1">
                  Obtain your SendGrid API key from your SendGrid account dashboard.
                </p>
              </div>
              
              <div className="border rounded-md p-4 bg-muted/50">
                <h4 className="text-sm font-medium mb-2">Terms & Conditions</h4>
                <div className="h-40 overflow-y-auto text-xs p-2 border rounded bg-background mb-2">
                  <p className="mb-2"><strong>Email Outreach Terms and Conditions</strong></p>
                  <p className="mb-2">By using the LinkDripAI email outreach functionality, you agree to the following terms:</p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>You will not use this service to send unsolicited commercial emails (spam).</li>
                    <li>You will comply with all applicable email marketing laws and regulations, including CAN-SPAM, GDPR, and other relevant legislation.</li>
                    <li>You will not use this service to send emails containing misleading, harmful, or illegal content.</li>
                    <li>You understand that LinkDripAI acts as a technical service provider and is not responsible for the content of the emails you send.</li>
                    <li>You are responsible for handling any unsubscribe requests or complaints related to your email campaigns.</li>
                    <li>You will maintain accurate and up-to-date contact information in your account.</li>
                    <li>You will respect the intellectual property rights of others in the content of your emails.</li>
                    <li>You will not attempt to hide or misrepresent your identity as the sender of the emails.</li>
                    <li>You understand that abuse of this service may result in suspension or termination of your account.</li>
                    <li>You will indemnify and hold harmless LinkDripAI from any claims arising from your use of the email outreach functionality.</li>
                  </ol>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="terms-agreement" className="rounded" />
                  <label htmlFor="terms-agreement" className="text-xs">
                    I agree to the Terms & Conditions governing email usage
                  </label>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline">
                Cancel
              </Button>
              <Button>
                Save & Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
