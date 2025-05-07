import Layout from "@/components/layout";
import StatCard from "@/components/stat-card";
import OpportunityCard from "@/components/opportunity-card";
import OutreachTable from "@/components/outreach-table";
import EmailGenerator from "@/components/email-generator";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Prospect, OutreachEmail } from "@shared/schema";
import { Loader2, Search, Link2, CreditCard, Mail, Award } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  
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
  
  const { data: recentEmails, isLoading: isLoadingEmails } = useQuery({
    queryKey: ["/api/emails/recent"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/emails/recent");
      return await res.json();
    },
  });
  
  const handleEmailClick = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setEmailDialogOpen(true);
  };
  
  const handleViewEmail = (email: OutreachEmail) => {
    // Implement email viewing functionality
    console.log("View email:", email);
  };
  
  return (
    <Layout title="Welcome back">
      {/* Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoadingStats ? (
          Array(4).fill(0).map((_, i) => (
            <Card key={i} className="p-6">
              <div className="animate-pulse flex space-x-4">
                <div className="rounded-full bg-slate-200 h-10 w-10"></div>
                <div className="flex-1 space-y-3 py-1">
                  <div className="h-2 bg-slate-200 rounded"></div>
                  <div className="h-4 bg-slate-200 rounded"></div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Daily Opportunities"
              value={stats?.dailyOpportunities ? `${stats.dailyOpportunities.used} / ${stats.dailyOpportunities.total}` : "0 / 0"}
              icon={<Link2 />}
              iconBgColor="bg-blue-100"
              iconColor="text-primary-600"
              progressValue={stats?.dailyOpportunities ? (stats.dailyOpportunities.used / stats.dailyOpportunities.total) * 100 : 0}
              progressColor="bg-primary-500"
            />
            
            <StatCard
              title="Credits Available"
              value={stats?.credits ? `${stats.credits.available} / ${stats.credits.total}` : "0 / 0"}
              icon={<CreditCard />}
              iconBgColor="bg-green-100"
              iconColor="text-success-500"
              progressValue={stats?.credits ? (stats.credits.available / stats.credits.total) * 100 : 0}
              progressColor="bg-success-500"
            />
            
            <StatCard
              title="Emails Sent"
              value={stats?.emailsSent ? stats.emailsSent.total.toString() : "0"}
              icon={<Mail />}
              iconBgColor="bg-purple-100"
              iconColor="text-purple-600"
              additionalInfo={stats?.emailsSent ? {
                label: "This month",
                value: `${stats.emailsSent.changePercentage}% increase`,
                isPositive: stats.emailsSent.changePercentage > 0,
              } : undefined}
            />
            
            <StatCard
              title="Backlinks Secured"
              value={stats?.backlinksSecured ? stats.backlinksSecured.total.toString() : "0"}
              icon={<Award />}
              iconBgColor="bg-yellow-100"
              iconColor="text-yellow-600"
              additionalInfo={stats?.backlinksSecured ? {
                label: `Average DA: ${stats.backlinksSecured.averageDA}`,
                value: `${stats.backlinksSecured.new} new`,
                isPositive: true,
              } : undefined}
            />
          </>
        )}
      </div>

      {/* Fresh opportunities section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Today's Fresh Opportunities</h2>
          <div className="flex items-center">
            <div className="relative mr-2 w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <Input
                type="search"
                placeholder="Search opportunities"
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm" className="text-xs">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </Button>
          </div>
        </div>

        {/* Opportunity cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoadingOpportunities ? (
            Array(3).fill(0).map((_, i) => (
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
            ))
          ) : opportunities && opportunities.length > 0 ? (
            opportunities.map((prospect: Prospect) => (
              <OpportunityCard 
                key={prospect.id} 
                prospect={prospect}
                onEmail={() => handleEmailClick(prospect)}
              />
            ))
          ) : (
            <div className="col-span-3 p-8 text-center">
              <p className="text-gray-500">No opportunities available today. Check back tomorrow!</p>
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <Button variant="outline" asChild>
            <Link href="/opportunities">
              Show more opportunities
              <svg xmlns="http://www.w3.org/2000/svg" className="ml-1.5 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Link>
          </Button>
        </div>
      </div>

      {/* Recent outreach section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Recent Outreach</h2>
          <Link href="/email-outreach" className="text-sm font-medium text-primary-600 hover:text-primary-500">
            View all outreach
          </Link>
        </div>

        {isLoadingEmails ? (
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
        ) : recentEmails && recentEmails.length > 0 ? (
          <OutreachTable 
            emails={recentEmails} 
            onViewEmail={handleViewEmail} 
          />
        ) : (
          <Card className="p-8 text-center">
            <CardContent>
              <p className="text-gray-500">No outreach emails sent yet. Start by unlocking a prospect and sending an email!</p>
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
