import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  ExternalLink, 
  Mail, 
  Phone, 
  MessageSquare, 
  Globe, 
  Star,
  Check,
  Facebook,
  Twitter,
  Linkedin,
  User
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EmailOutreachForm } from "./email-outreach-form";

interface OpportunityDetailDialogProps {
  opportunity: any;
  websiteId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function OpportunityDetailDialog({
  opportunity,
  websiteId,
  isOpen,
  onClose
}: OpportunityDetailDialogProps) {
  const [activeTab, setActiveTab] = useState("details");
  const { toast } = useToast();
  const [isSaved, setIsSaved] = useState(opportunity.isSaved || false);

  // Handle saving the opportunity
  const handleSave = async () => {
    try {
      const res = await fetch(`/api/opportunities/${opportunity.id}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteId })
      });
      
      if (res.ok) {
        setIsSaved(true);
        toast({
          title: "Opportunity saved",
          description: "This opportunity has been saved to your favorites.",
        });
      } else {
        throw new Error("Failed to save opportunity");
      }
    } catch (err) {
      toast({
        title: "Error saving opportunity",
        description: "There was a problem saving this opportunity.",
        variant: "destructive"
      });
    }
  };

  // Get quality color based on domain authority
  const getQualityColor = () => {
    const da = opportunity.domainAuthority || 0;
    if (da >= 50) return "text-green-600";
    if (da >= 30) return "text-amber-600";
    return "text-slate-600";
  };

  // Format the domain from URL
  const getDomain = (url: string) => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain;
    } catch (e) {
      return url;
    }
  };

  // Check if there's contact info available
  const hasContactEmail = opportunity.contactInfo?.emails && opportunity.contactInfo.emails.length > 0;
  const hasContactForm = opportunity.contactInfo?.contactForms && opportunity.contactInfo.contactForms.length > 0;
  const hasSocialProfiles = opportunity.contactInfo?.socialProfiles && opportunity.contactInfo.socialProfiles.length > 0;
  const hasPhone = opportunity.contactInfo?.phoneNumbers && opportunity.contactInfo.phoneNumbers.length > 0;
  
  // Get domain initial for avatar
  const getDomainInitial = () => {
    const domain = getDomain(opportunity.url);
    return domain.charAt(0).toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 bg-primary/10">
              <AvatarFallback>{getDomainInitial()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <DialogTitle className="text-xl mb-1 truncate">
                {opportunity.title || getDomain(opportunity.url)}
                {isSaved && <Star className="inline-block ml-2 h-4 w-4 fill-yellow-400 text-yellow-400" />}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                <a
                  href={opportunity.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline flex items-center truncate max-w-[300px]"
                >
                  {opportunity.url}
                  <ExternalLink className="h-3 w-3 ml-1 inline-block" />
                </a>
                {opportunity.sourceType && (
                  <Badge variant="outline" className="ml-2 capitalize">
                    {opportunity.sourceType.replace(/_/g, ' ')}
                  </Badge>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 my-4">
          <div className="bg-slate-50 p-3 rounded-md text-center">
            <div className={`text-xl font-bold ${getQualityColor()}`}>
              {opportunity.domainAuthority || '?'}
            </div>
            <div className="text-xs text-slate-500">Domain Authority</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-md text-center">
            <div className="text-xl font-bold">
              {opportunity.relevanceScore ? `${opportunity.relevanceScore}%` : '?'}
            </div>
            <div className="text-xs text-slate-500">Relevance</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-md text-center">
            <div className="text-xl font-bold">
              {opportunity.spamScore !== undefined ? opportunity.spamScore : '?'}
            </div>
            <div className="text-xs text-slate-500">Spam Score</div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="outreach">Outreach</TabsTrigger>
          </TabsList>
          
          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            {opportunity.description && (
              <div>
                <h3 className="text-sm font-medium mb-1">Description</h3>
                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded">
                  {opportunity.description}
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <h3 className="text-sm font-medium mb-1">Discovery Date</h3>
                <p className="text-sm text-slate-600">
                  {new Date(opportunity.discoveredAt || Date.now()).toLocaleDateString()}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-1">Match Quality</h3>
                <p className="text-sm text-slate-600 capitalize">
                  {opportunity.matchQuality || "standard"}
                </p>
              </div>
            </div>
            
            {opportunity.categories && opportunity.categories.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-1">Categories</h3>
                <div className="flex flex-wrap gap-1">
                  {opportunity.categories.map((category: string, index: number) => (
                    <Badge key={index} variant="secondary">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {opportunity.metadataRaw && (
              <div>
                <h3 className="text-sm font-medium mb-1">Metadata</h3>
                <div className="bg-slate-50 p-3 rounded text-xs font-mono overflow-auto max-h-32">
                  <pre>{JSON.stringify(opportunity.metadataRaw, null, 2)}</pre>
                </div>
              </div>
            )}
          </TabsContent>
          
          {/* Contact Tab */}
          <TabsContent value="contact" className="space-y-4">
            <div className="space-y-3">
              {hasContactEmail ? (
                <div>
                  <h3 className="text-sm font-medium mb-1">Email Addresses</h3>
                  <ul className="space-y-2">
                    {opportunity.contactInfo.emails.map((email: string, index: number) => (
                      <li key={index} className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-blue-500" />
                        <a href={`mailto:${email}`} className="text-blue-500 hover:underline">
                          {email}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="bg-amber-50 p-3 rounded border border-amber-200">
                  <p className="text-sm text-amber-700">No email addresses found.</p>
                </div>
              )}
              
              {hasContactForm && (
                <div>
                  <h3 className="text-sm font-medium mb-1">Contact Form</h3>
                  <ul className="space-y-2">
                    {opportunity.contactInfo.contactForms.map((formUrl: string, index: number) => (
                      <li key={index} className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-green-500" />
                        <a href={formUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate max-w-[400px]">
                          {formUrl}
                          <ExternalLink className="h-3 w-3 ml-1 inline-block" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {hasPhone && (
                <div>
                  <h3 className="text-sm font-medium mb-1">Phone Numbers</h3>
                  <ul className="space-y-2">
                    {opportunity.contactInfo.phoneNumbers.map((phone: string, index: number) => (
                      <li key={index} className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-purple-500" />
                        <a href={`tel:${phone}`} className="text-blue-500 hover:underline">
                          {phone}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {hasSocialProfiles && (
                <div>
                  <h3 className="text-sm font-medium mb-1">Social Profiles</h3>
                  <ul className="space-y-2">
                    {opportunity.contactInfo.socialProfiles.map((profile: any, index: number) => {
                      // Choose icon based on platform
                      let Icon = Globe;
                      if (profile.platform.toLowerCase().includes('facebook')) Icon = Facebook;
                      if (profile.platform.toLowerCase().includes('twitter')) Icon = Twitter;
                      if (profile.platform.toLowerCase().includes('linkedin')) Icon = Linkedin;
                      if (profile.platform.toLowerCase().includes('profile')) Icon = User;
                      
                      return (
                        <li key={index} className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-indigo-500" />
                          <span className="text-slate-600 capitalize">{profile.platform}:</span>
                          <a href={profile.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate max-w-[300px]">
                            {profile.username || profile.url}
                            <ExternalLink className="h-3 w-3 ml-1 inline-block" />
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              
              {!hasContactEmail && !hasContactForm && !hasSocialProfiles && !hasPhone && (
                <div className="bg-amber-50 p-3 rounded border border-amber-200">
                  <p className="text-sm text-amber-700">No contact information found for this opportunity.</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          {/* Outreach Tab */}
          <TabsContent value="outreach" className="space-y-4">
            <EmailOutreachForm 
              opportunity={opportunity}
              websiteId={websiteId}
              onSuccess={() => {
                setActiveTab("details");
                toast({
                  title: "Email sent",
                  description: "Your outreach email has been sent successfully.",
                });
              }}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between items-center">
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaved}
              className={isSaved ? "bg-yellow-50 border-yellow-200 text-yellow-700" : ""}
            >
              {isSaved ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Saved
                </>
              ) : (
                <>
                  <Star className="h-4 w-4 mr-1" />
                  Save
                </>
              )}
            </Button>
          </div>
          <div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => setActiveTab("outreach")}
              className="ml-2"
            >
              <Mail className="h-4 w-4 mr-1" />
              Contact
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}