import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Prospect } from "@shared/schema";
import { Link } from "wouter";
import { 
  LockIcon, 
  Unlock, 
  Star, 
  Mail, 
  EyeOff,
  ExternalLink,
  BadgeCheck,
  Tag,
  Globe,
  Shield,
  Link2,
  Activity,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SimpleCheckbox } from "@/components/simple-checkbox";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

interface OpportunityCardProps {
  prospect: Prospect;
  onUnlock?: () => void;
  onSave?: () => void;
  onEmail?: () => void;
  onHide?: () => void;
  isNew?: boolean; // Use this to override the prospect.isNew property
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
  view?: "grid" | "list";
}

export default function OpportunityCard({ 
  prospect, 
  onUnlock, 
  onSave, 
  onEmail,
  onHide,
  isNew = false,
  selectable = false,
  selected = false,
  onSelectChange,
  view = "grid"
}: OpportunityCardProps) {
  const { toast } = useToast();
  const [isHovering, setIsHovering] = useState(false);
  
  const unlockMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/prospects/${prospect.id}/unlock`, {});
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/prospects/daily"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prospects/unlocked"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Dispatch an event to notify about the unlock
      window.dispatchEvent(new Event('prospect-unlocked'));
      
      toast({
        title: "Prospect unlocked",
        description: "You can now see the full details and contact information.",
      });
      if (onUnlock) onUnlock();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to unlock prospect",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/prospects/${prospect.id}/save`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prospects/saved"] });
      toast({
        title: "Prospect starred",
        description: "You can find this in your starred opportunities.",
      });
      if (onSave) onSave();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to star opportunity",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const hideMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/prospects/${prospect.id}/hide`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prospects/daily"] });
      toast({
        title: "Opportunity hidden",
        description: "You can find this in your hidden opportunities filter.",
      });
      if (onHide) onHide();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to hide opportunity",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUnlock = () => {
    unlockMutation.mutate();
  };
  
  const handleSave = () => {
    saveMutation.mutate();
  };
  
  const handleEmail = () => {
    if (onEmail) onEmail();
  };
  
  const handleHide = () => {
    if (hideMutation.isPending) return;
    hideMutation.mutate();
    // No need to call onHide here, it's already called in onSuccess
  };

  const handleSelectChange = (checked: boolean) => {
    if (onSelectChange) {
      onSelectChange(checked);
    }
  };

  const getStatusIcon = () => {
    if (prospect.isUnlocked) {
      if (prospect.isSaved) {
        return <Star className="h-4 w-4 text-amber-500" />;
      }
      return <Unlock className="h-4 w-4 text-green-600" />;
    }
    return <LockIcon className="h-4 w-4 text-gray-500" />;
  };

  const renderGridView = () => (
    <Card 
      className={cn(
        "relative overflow-hidden h-full transition-all duration-200",
        isNew ? "border-l-4 border-l-amber-400" : "",
        prospect.isUnlocked ? "shadow-sm" : "shadow-sm",
        isHovering ? "shadow-md" : ""
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Selection checkbox */}
      {selectable && (
        <div className="absolute top-4 left-4 z-10">
          <SimpleCheckbox 
            checked={selected === true}
            onChange={handleSelectChange} 
          />
        </div>
      )}

      {/* "New" indicator */}
      {isNew && (
        <div className="absolute top-4 right-4 z-10">
          <Badge className="bg-amber-100 text-amber-800 border-none text-xs">New</Badge>
        </div>
      )}

      <CardContent className="p-4 pt-10">
        {/* Domain Authority */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded bg-primary-50 flex items-center justify-center mr-2">
              <span className="text-primary-700 font-bold">{prospect.domainAuthority}</span>
            </div>
            <div>
              <p className="text-xs text-gray-500">Domain Authority</p>
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">Fit Score:</span>
                        <div className="h-1.5 w-10 bg-gray-100 rounded-full">
                          <div 
                            className={cn(
                              "h-1.5 rounded-full",
                              prospect.fitScore >= 80 ? "bg-green-500" :
                              prospect.fitScore >= 60 ? "bg-green-400" :
                              prospect.fitScore >= 40 ? "bg-yellow-500" : "bg-red-500"
                            )}
                            style={{ width: `${prospect.fitScore}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{prospect.fitScore}%</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={5} className="max-w-[300px] p-4">
                      <h4 className="text-sm font-medium mb-2">AI Match Score: {prospect.fitScore}%</h4>
                      <p className="text-xs text-gray-600 mb-3">Our AI analyzed this opportunity based on your website's niche, content, and preferences</p>
                      
                      {prospect.matchReasons && prospect.matchReasons.length > 0 ? (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-md p-2">
                          <h5 className="text-xs font-medium text-emerald-700 mb-1.5 flex items-center">
                            <BadgeCheck className="h-3.5 w-3.5 mr-1.5" />
                            Why this is a good match:
                          </h5>
                          <ul className="text-xs text-emerald-800 space-y-1.5">
                            {prospect.matchReasons.map((reason, idx) => (
                              <li key={idx} className="flex items-start">
                                <span className="mr-1.5 text-emerald-500 mt-0.5">•</span>
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 italic">
                          No specific match reasons available
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {getStatusIcon()}
          </div>
        </div>

        {/* Main Content */}
        <div className="mb-4">
          <h3 className="font-medium text-gray-900 mb-1 line-clamp-1">
            {prospect.isUnlocked ? prospect.siteName : "Domain locked"}
          </h3>
          
          <div className="flex flex-wrap gap-1 mb-2">
            <Badge variant="outline" className="text-xs bg-gray-50 px-2 py-0">
              {prospect.siteType}
            </Badge>
            <Badge variant="outline" className="text-xs bg-gray-50 px-2 py-0">
              {prospect.niche}
            </Badge>
          </div>
          
          <div className="text-xs text-gray-500 space-y-1">
            {/* Only shown when unlocked: Domain and contact info */}
            {prospect.isUnlocked && (
              <>
                <div className="flex items-center">
                  <Globe className="h-3 w-3 mr-1.5 flex-shrink-0 opacity-60" />
                  <span className="truncate">{prospect.domain || (prospect.siteName && `${prospect.siteName.toLowerCase().replace(/\s+/g, '')}.com`)}</span>
                </div>
                {prospect.contactEmail && (
                  <div className="flex items-center">
                    <Mail className="h-3 w-3 mr-1.5 flex-shrink-0 opacity-60" />
                    <span className="truncate">{prospect.contactEmail}</span>
                  </div>
                )}
              </>
            )}
            
            {/* Show a message when locked */}
            {!prospect.isUnlocked && (
              <div className="mb-2">Unlock to view domain and contact details</div>
            )}
            
            {/* Moz Metrics Section - Always visible */}
            <div className={cn("pt-1", !prospect.isUnlocked ? "mt-1" : "mt-2 pt-1 border-t border-gray-100")}>
              <h4 className="text-xs font-medium mb-1.5">SEO Metrics</h4>
              <div className="grid grid-cols-2 gap-2">
                {prospect.pageAuthority && (
                  <div className="flex items-center">
                    <Activity className="h-3 w-3 mr-1.5 flex-shrink-0 opacity-60" />
                    <span>PA: {prospect.pageAuthority}</span>
                  </div>
                )}
                {prospect.spamScore && (
                  <div className="flex items-center">
                    <Shield className="h-3 w-3 mr-1.5 flex-shrink-0 opacity-60" />
                    <span>Spam: {prospect.spamScore}</span>
                  </div>
                )}
                {prospect.rootDomainsLinking && (
                  <div className="flex items-center">
                    <Link2 className="h-3 w-3 mr-1.5 flex-shrink-0 opacity-60" />
                    <span>Domains: {prospect.rootDomainsLinking}</span>
                  </div>
                )}
                {prospect.totalLinks && (
                  <div className="flex items-center">
                    <ExternalLink className="h-3 w-3 mr-1.5 flex-shrink-0 opacity-60" />
                    <span>Links: {prospect.totalLinks}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Actions */}
      <CardFooter className="px-4 py-3 border-t flex flex-wrap gap-2 bg-gray-50">
        {prospect.isUnlocked ? (
          <>
            <Button 
              variant="default" 
              size="sm" 
              className="flex-1 h-8 text-xs"
              onClick={handleEmail}
            >
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              <span>Send Email</span>
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              className="h-8 w-8" 
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              <Star className={cn("h-3.5 w-3.5", prospect.isSaved ? "fill-amber-400 text-amber-400" : "")} />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              className="h-8 w-8"
              onClick={handleHide}
            >
              <EyeOff className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Button 
            className="w-full flex items-center justify-center h-8 text-xs"
            onClick={handleUnlock}
            disabled={unlockMutation.isPending}
          >
            <Unlock className="h-3.5 w-3.5 mr-1.5" />
            {unlockMutation.isPending ? 'Unlocking...' : 'Unlock (1 credit)'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );

  const renderListView = () => (
    <div 
      className={cn(
        "relative w-full p-3 border rounded-lg flex items-center gap-3 transition-all duration-200",
        isNew ? "border-l-4 border-l-amber-400 pl-4" : "",
        prospect.isUnlocked ? "bg-white shadow-sm" : "bg-gray-50",
        isHovering ? "shadow-md" : ""
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Selection checkbox */}
      {selectable && (
        <div className="flex-shrink-0">
          <SimpleCheckbox 
            checked={selected === true}
            onChange={handleSelectChange}
            size="sm"
          />
        </div>
      )}

      {/* DA Score */}
      <div className="w-10 h-10 flex-shrink-0 rounded bg-primary-50 text-primary-700 flex items-center justify-center">
        <span className="font-bold">{prospect.domainAuthority}</span>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <h3 className="font-medium text-gray-900 text-sm truncate">
            {prospect.isUnlocked ? prospect.siteName : "Domain locked"}
          </h3>
          {isNew && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-800 border-none">
              New
            </Badge>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <Badge variant="outline" className="text-[10px] px-2 py-0 h-4 bg-gray-50">
            {prospect.siteType}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-2 py-0 h-4 bg-gray-50">
            {prospect.niche}
          </Badge>
        </div>
        
        {/* Site domain is only shown when unlocked */}
        {prospect.isUnlocked && (
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <Globe className="h-3 w-3 text-gray-400" />
            <span className="truncate">{prospect.domain || (prospect.siteName && `${prospect.siteName.toLowerCase().replace(/\s+/g, '')}.com`)}</span>
          </div>
        )}
        
        {/* Lock status message - show when locked */}
        {!prospect.isUnlocked && (
          <div className="text-xs text-gray-500 mb-1">
            Unlock to view domain and contact details
          </div>
        )}
        
        {/* Moz Metrics Tags - Always visible, only on medium screens and up */}
        <div className="hidden md:flex mt-1 flex-wrap gap-2 text-[10px]">
          {prospect.pageAuthority && (
            <Badge variant="outline" className="py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">
              <Activity className="h-2.5 w-2.5 mr-1" />
              PA: {prospect.pageAuthority}
            </Badge>
          )}
          {prospect.spamScore && (
            <Badge variant="outline" className="py-0 h-4 bg-red-50 text-red-700 border-red-200">
              <Shield className="h-2.5 w-2.5 mr-1" />
              Spam: {prospect.spamScore}
            </Badge>
          )}
          {prospect.rootDomainsLinking && (
            <Badge variant="outline" className="py-0 h-4 bg-green-50 text-green-700 border-green-200">
              <Link2 className="h-2.5 w-2.5 mr-1" />
              RD: {prospect.rootDomainsLinking}
            </Badge>
          )}
        </div>
      </div>

      {/* Fit Score */}
      <div className="hidden md:flex flex-shrink-0 items-center">
        <div className="text-xs text-gray-500 mr-2">Fit Score:</div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center">
                <div className="w-16 bg-gray-100 rounded-full h-1.5">
                  <div 
                    className={cn(
                      "h-1.5 rounded-full",
                      prospect.fitScore >= 80 ? "bg-green-500" :
                      prospect.fitScore >= 60 ? "bg-green-400" :
                      prospect.fitScore >= 40 ? "bg-yellow-500" : "bg-red-500"
                    )}
                    style={{ width: `${prospect.fitScore}%` }}
                  ></div>
                </div>
                <span className="ml-2 text-xs font-medium">{prospect.fitScore}%</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={5} className="max-w-[300px] p-4">
              <h4 className="text-sm font-medium mb-2">AI Match Score: {prospect.fitScore}%</h4>
              <p className="text-xs text-gray-600 mb-3">Our AI analyzed this opportunity based on your website's niche, content, and preferences</p>
              
              {prospect.matchReasons && prospect.matchReasons.length > 0 ? (
                <div className="bg-emerald-50 border border-emerald-100 rounded-md p-2">
                  <h5 className="text-xs font-medium text-emerald-700 mb-1.5 flex items-center">
                    <BadgeCheck className="h-3.5 w-3.5 mr-1.5" />
                    Why this is a good match:
                  </h5>
                  <ul className="text-xs text-emerald-800 space-y-1.5">
                    {prospect.matchReasons.map((reason, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="mr-1.5 text-emerald-500 mt-0.5">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-xs text-gray-500 italic">
                  No specific match reasons available
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        {prospect.isUnlocked ? (
          <>
            <Button 
              variant="default" 
              size="sm" 
              className="h-8 text-xs"
              onClick={handleEmail}
            >
              <Mail className="h-3.5 w-3.5 mr-1" />
              <span>Email</span>
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              className="h-8 w-8" 
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              <Star className={cn("h-3.5 w-3.5", prospect.isSaved ? "fill-amber-400 text-amber-400" : "")} />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              className="h-8 w-8"
              onClick={handleHide}
            >
              <EyeOff className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Button 
            className="flex items-center justify-center h-8 text-xs"
            onClick={handleUnlock}
            disabled={unlockMutation.isPending}
          >
            <Unlock className="h-3.5 w-3.5 mr-1" />
            {unlockMutation.isPending ? 'Unlocking...' : 'Unlock (1 cr)'}
          </Button>
        )}
      </div>
    </div>
  );

  return view === "grid" ? renderGridView() : renderListView();
}
