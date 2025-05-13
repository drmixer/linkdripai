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
import { Search, Filter, Mail, Inbox, PlusCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function EmailOutreach() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<OutreachEmail | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailViewDialogOpen, setEmailViewDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [showEmailSetupModal, setShowEmailSetupModal] = useState(false);
  const [, setLocation] = useLocation();
  
  const navigateToOpportunities = () => setLocation('/opportunities');

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
      ) : !emailSettings?.isConfigured ? (
        <Card className="p-8 text-center">
          <CardContent className="flex flex-col items-center justify-center pt-6">
            <Mail className="mx-auto h-12 w-12 text-amber-500 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">Set Up Email Integration</h3>
            <p className="text-base text-gray-600 max-w-lg mx-auto mb-6">
              You need to configure your email settings to start sending outreach emails directly from LinkDripAI.
            </p>
            <Button 
              size="lg"
              onClick={() => setShowEmailSetupModal(true)}
              className="px-6 mb-4"
            >
              Configure Email Settings
            </Button>
            <p className="text-sm text-muted-foreground">
              Your email settings are securely stored and used only for sending your outreach emails.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-8">
          <CardContent className="flex flex-col items-center justify-center text-center pt-6">
            <Inbox className="mx-auto h-12 w-12 text-slate-400 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No Emails Found</h3>
            <p className="text-base text-gray-600 max-w-lg mx-auto mb-6">
              {activeTab === "all" && searchTerm === "" 
                ? "You haven't sent any outreach emails yet. Get started by browsing your opportunities and sending your first email."
                : "No emails match your current filters. Try adjusting your search or selecting a different category."}
            </p>
            {activeTab === "all" && searchTerm === "" ? (
              <Button onClick={navigateToOpportunities} size="lg" className="px-6">
                Browse Opportunities
              </Button>
            ) : (
              <Button onClick={() => { setActiveTab("all"); setSearchTerm(""); }} variant="outline" size="lg" className="px-6">
                Clear Filters
              </Button>
            )}
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
      <Dialog 
        open={showEmailSetupModal} 
        onOpenChange={setShowEmailSetupModal}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Manage Email Settings</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You can manage your email integration settings for outreach campaigns here, or update them in your account settings.
              </p>
            </div>
            
            <div className="grid gap-4">
              <div>
                <label className="text-sm font-medium block mb-1">Email Integration Method</label>
                <Select defaultValue={emailSettings?.provider || "sendgrid"}>
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
                <Input placeholder="your@email.com" defaultValue={emailSettings?.fromEmail || ""} />
                <p className="text-xs text-muted-foreground mt-1">
                  This email address will be shown as the sender of your outreach emails.
                </p>
              </div>
              
              {/* Show different fields based on provider */}
              {(emailSettings?.provider === "sendgrid" || !emailSettings?.provider) && (
                <div>
                  <label className="text-sm font-medium block mb-1">SendGrid API Key</label>
                  <Input type="password" placeholder="Your SendGrid API Key" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Obtain your SendGrid API key from your SendGrid account dashboard.
                  </p>
                </div>
              )}
              
              {emailSettings?.provider === "smtp" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium block mb-1">SMTP Server</label>
                      <Input placeholder="smtp.example.com" />
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1">Port</label>
                      <Input placeholder="587" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium block mb-1">Username</label>
                      <Input placeholder="smtp_username" />
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1">Password</label>
                      <Input type="password" placeholder="smtp_password" />
                    </div>
                  </div>
                </>
              )}
              
              {emailSettings?.provider === "gmail" && (
                <>
                  <div>
                    <label className="text-sm font-medium block mb-1">Google Client ID</label>
                    <Input placeholder="Your Google Client ID" />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Google Client Secret</label>
                    <Input type="password" placeholder="Your Google Client Secret" />
                  </div>
                </>
              )}
              
              <div className="border rounded-md p-4 bg-muted/50">
                <h4 className="text-sm font-medium mb-2">Email Verification</h4>
                <p className="text-sm mb-2">
                  To ensure deliverability and prevent abuse, we need to verify your sending email address.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Button size="sm" variant="outline">Send Verification Email</Button>
                  <span className="text-xs text-muted-foreground">
                    {emailSettings?.isConfigured ? "Email verified" : "Email not verified"}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowEmailSetupModal(false)}>
                Cancel
              </Button>
              <Button>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
