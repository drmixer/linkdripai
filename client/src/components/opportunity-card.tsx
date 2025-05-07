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
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
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
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
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
    // Call the parent component's onHide callback if provided
    if (onHide) onHide();
  };

  const handleSelectChange = (checked: boolean | "indeterminate") => {
    if (onSelectChange && typeof checked === "boolean") {
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
        prospect.isUnlocked ? "shadow-md" : "shadow",
        isHovering ? "shadow-lg" : ""
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Traffic indicator & DA score */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100">
        <div 
          className="h-full bg-green-500" 
          style={{ width: `${parseInt(prospect.monthlyTraffic) / 10000 * 100}%`, maxWidth: '100%' }}
        ></div>
      </div>

      {/* Selection checkbox */}
      {selectable && (
        <div className="absolute top-3 left-3 z-10">
          <Checkbox 
            id={`prospect-grid-${prospect.id}`}
            checked={selected}
            onCheckedChange={handleSelectChange} 
            className="focus:ring-0"
          />
        </div>
      )}

      {/* Fit score */}
      <div className="absolute top-3 right-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="bg-white border-gray-200 text-xs font-medium">
                <BadgeCheck className="h-3 w-3 mr-1 text-green-500" />
                {prospect.fitScore}% Fit
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>AI-calculated relevance score based on your site</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <CardContent className="p-5 pt-8">
        <div className="flex flex-col space-y-4">
          {/* Header with DA and type */}
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-md bg-primary-50 text-primary-700 flex items-center justify-center font-bold text-lg">
                  {prospect.domainAuthority}
                </div>
                <div>
                  <Badge variant="outline" className="text-xs border-gray-200">
                    <Globe className="h-3 w-3 mr-1 opacity-70" />
                    {prospect.siteType}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
            </div>
          </div>

          {/* Main Content */}
          <div>
            <h3 className="font-medium text-gray-900 mb-1">
              {prospect.isUnlocked ? prospect.siteName : "Domain locked"}
            </h3>
            
            <div className="mb-2 flex items-center">
              <Badge variant="outline" className="text-xs bg-gray-50">
                <Tag className="h-3 w-3 mr-1 opacity-70" />
                {prospect.niche}
              </Badge>
            </div>
            
            {prospect.isUnlocked && (
              <div className="mt-2 space-y-1.5 text-xs text-gray-500">
                <div className="flex items-center">
                  <Globe className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                  <span className="truncate">{prospect.domain || (prospect.siteName && `${prospect.siteName.toLowerCase().replace(/\s+/g, '')}.com`)}</span>
                </div>
                {prospect.contactEmail && (
                  <div className="flex items-center">
                    <Mail className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                    <span className="truncate">{prospect.contactEmail}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* Actions */}
      <CardFooter className="p-3 pt-0 flex flex-wrap gap-2 mt-auto">
        {prospect.isUnlocked ? (
          <>
            <Button 
              variant="default" 
              size="sm" 
              className="flex-1 h-9"
              onClick={handleEmail}
            >
              <Mail className="h-4 w-4 mr-1.5" />
              <span>Email</span>
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              className="h-9 w-9" 
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              <Star className={cn("h-4 w-4", prospect.isSaved ? "fill-amber-400 text-amber-400" : "")} />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              className="h-9 w-9"
              onClick={handleHide}
            >
              <EyeOff className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button 
            className="w-full flex items-center justify-center h-9"
            onClick={handleUnlock}
            disabled={unlockMutation.isPending}
          >
            <Unlock className="h-4 w-4 mr-1.5" />
            {unlockMutation.isPending ? 'Unlocking...' : 'Unlock for 1 credit'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );

  const renderListView = () => (
    <div 
      className={cn(
        "relative w-full p-4 border rounded-lg flex items-center gap-4 transition-all duration-200",
        isNew ? "border-l-4 border-l-amber-400 pl-5" : "",
        prospect.isUnlocked ? "bg-white shadow-sm" : "bg-gray-50",
        isHovering ? "shadow-md" : ""
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Selection checkbox */}
      {selectable && (
        <div className="flex-shrink-0">
          <Checkbox 
            id={`prospect-list-${prospect.id}`}
            checked={selected}
            onCheckedChange={handleSelectChange} 
            className="focus:ring-0"
          />
        </div>
      )}

      {/* DA Score */}
      <div className="w-12 h-12 flex-shrink-0 rounded-md bg-primary-50 text-primary-700 flex items-center justify-center">
        <div className="text-center">
          <div className="font-bold text-lg leading-none">{prospect.domainAuthority}</div>
          <div className="text-[10px] opacity-70">DA</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium text-gray-900 truncate">
            {prospect.isUnlocked ? prospect.siteName : "Domain locked"}
          </h3>
          <Badge variant="outline" className="text-xs border-gray-200 whitespace-nowrap flex-shrink-0">
            <Globe className="h-3 w-3 mr-1 opacity-70" />
            {prospect.siteType}
          </Badge>
          <Badge variant="outline" className="text-xs bg-gray-50 whitespace-nowrap flex-shrink-0">
            <Tag className="h-3 w-3 mr-1 opacity-70" />
            {prospect.niche}
          </Badge>
        </div>
        
        {prospect.isUnlocked && (
          <div className="text-sm text-gray-500 flex items-center gap-4">
            <span className="truncate">{prospect.domain || (prospect.siteName && `${prospect.siteName.toLowerCase().replace(/\s+/g, '')}.com`)}</span>
            {prospect.contactEmail && (
              <span className="truncate">{prospect.contactEmail}</span>
            )}
          </div>
        )}
      </div>

      {/* Fit Score */}
      <div className="hidden md:block flex-shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center">
                <div className="w-16 bg-gray-100 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-green-500" 
                    style={{ width: `${prospect.fitScore}%` }}
                  ></div>
                </div>
                <span className="ml-2 text-sm font-medium text-gray-700">{prospect.fitScore}%</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>AI-calculated relevance score based on your site</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Status */}
      <div className="flex-shrink-0 w-6">
        {getStatusIcon()}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {prospect.isUnlocked ? (
          <>
            <Button 
              variant="default" 
              size="sm" 
              className="h-9"
              onClick={handleEmail}
            >
              <Mail className="h-4 w-4 mr-1.5" />
              <span>Email</span>
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              className="h-9 w-9" 
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              <Star className={cn("h-4 w-4", prospect.isSaved ? "fill-amber-400 text-amber-400" : "")} />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              className="h-9 w-9"
              onClick={handleHide}
            >
              <EyeOff className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button 
            className="flex items-center justify-center h-9"
            onClick={handleUnlock}
            disabled={unlockMutation.isPending}
          >
            <Unlock className="h-4 w-4 mr-1.5" />
            {unlockMutation.isPending ? 'Unlocking...' : 'Unlock'}
          </Button>
        )}
      </div>
    </div>
  );

  return view === "grid" ? renderGridView() : renderListView();
}
