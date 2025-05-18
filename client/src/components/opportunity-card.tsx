import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  ExternalLink, 
  Info, 
  Mail, 
  Star, 
  ThumbsUp, 
  Sparkles, 
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  PieChart
} from "lucide-react";
import { DiscoveredOpportunity } from '@shared/schema';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { MatchExplanation as ExplanationComponent, relevanceScoreColor } from './match-explanation';

// Import the interface from match-explanation
import { MatchExplanation } from './match-explanation';

interface OpportunityCardProps {
  opportunity: DiscoveredOpportunity;
  isPremium?: boolean;
  websiteId: number;
  onContactClick?: (opportunity: DiscoveredOpportunity) => void;
}

export default function OpportunityCard({ 
  opportunity,
  isPremium = false,
  websiteId,
  onContactClick
}: OpportunityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [matchExplanation, setMatchExplanation] = useState<MatchExplanation | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  // Function to load match explanation
  const loadMatchExplanation = async () => {
    if (matchExplanation || loadingExplanation) return;
    
    setLoadingExplanation(true);
    try {
      const response = await fetch(`/api/opportunities/${opportunity.id}/explain?websiteId=${websiteId}`);
      if (response.ok) {
        const data = await response.json();
        setMatchExplanation(data);
      } else {
        console.error('Failed to load match explanation');
      }
    } catch (error) {
      console.error('Error loading match explanation:', error);
    } finally {
      setLoadingExplanation(false);
    }
  };

  // Format domain from full URL
  const domain = opportunity.domain || '';
  const url = opportunity.url || '';
  const displayUrl = url.replace(/^https?:\/\//, '').split('/')[0];
  
  // Format contact info
  const contactInfo = opportunity.contactInfo || {};
  const hasContactEmail = contactInfo.emails && contactInfo.emails.length > 0;
  const hasContactForm = contactInfo.contactForms && contactInfo.contactForms.length > 0;
  const hasContactMethods = hasContactEmail || hasContactForm;
  
  // Quality indicators - convert all to 0-100 scale for consistency
  // Ensure we're parsing string values to numbers
  const domainAuthority = parseFloat(opportunity.domainAuthority as string) || 0;
  const daScore = Math.min(100, Math.round(domainAuthority));
  
  const pageAuthority = parseFloat(opportunity.pageAuthority as string) || 0;
  const paScore = Math.min(100, Math.round(pageAuthority));
  
  const spamScore = parseFloat(opportunity.spamScore as string) || 5;
  const spamScoreFormatted = spamScore.toFixed(1);
  // Invert spam score for display (lower is better)
  const spamScorePercent = Math.max(0, Math.min(100, 100 - (spamScore * 10)));

  // Calculate quality tier based on metrics
  const getQualityTier = () => {
    if (isPremium || domainAuthority >= 40) return 'premium';
    if (domainAuthority >= 30) return 'high';
    if (domainAuthority >= 20) return 'medium';
    return 'standard';
  };
  
  const qualityTier = getQualityTier();
  
  // Get color for quality tier
  const getQualityColor = () => {
    switch (qualityTier) {
      case 'premium': return 'bg-gradient-to-r from-violet-500 to-purple-600 text-white';
      case 'high': return 'bg-emerald-600 text-white';
      case 'medium': return 'bg-blue-600 text-white';
      default: return 'bg-slate-600 text-white';
    }
  };
  
  // Calculate badge color for spam score
  const getSpamScoreColor = () => {
    if (spamScore <= 2) return 'bg-green-100 text-green-800';
    if (spamScore <= 4) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <Card className={`w-full overflow-hidden transition-all duration-300 ${isPremium ? 'border-purple-400 shadow-purple-100 shadow-lg' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg line-clamp-1 font-semibold">
              {displayUrl}
              {isPremium && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Sparkles size={18} className="inline ml-2 text-purple-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Premium quality opportunity (DA 40+)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </CardTitle>
            <CardDescription className="line-clamp-1">
              {opportunity.sourceType && (
                <Badge variant="outline" className="mr-2">
                  {opportunity.sourceType.replace('_', ' ')}
                </Badge>
              )}
              <span className="text-xs text-slate-500">{url}</span>
            </CardDescription>
          </div>
          
          <Badge className={`${getQualityColor()} capitalize`}>
            {qualityTier} quality
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div className="flex flex-col">
            <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 cursor-help">
                      Domain Authority <Info size={12} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Domain Authority (DA) is a search engine ranking score that predicts how likely a website is to rank in search results</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">{domainAuthority.toFixed(1)}</span>
              <span className="text-xs text-slate-500">/100</span>
            </div>
            <Progress value={daScore} className="h-1.5" />
          </div>
          
          <div className="flex flex-col">
            <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 cursor-help">
                      Page Authority <Info size={12} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Page Authority (PA) predicts how well a specific page will rank in search results</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">{pageAuthority.toFixed(1)}</span>
              <span className="text-xs text-slate-500">/100</span>
            </div>
            <Progress value={paScore} className="h-1.5" />
          </div>
          
          <div className="flex flex-col">
            <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 cursor-help">
                      Spam Score <Info size={12} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Spam Score indicates how likely a site is to be penalized by search engines. Lower is better.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">{spamScoreFormatted}</span>
              <Badge variant="outline" className={`text-xs ${getSpamScoreColor()}`}>
                {spamScore <= 2 ? 'Low' : spamScore <= 4 ? 'Medium' : 'High'}
              </Badge>
            </div>
            <Progress value={spamScorePercent} className="h-1.5" />
          </div>
        </div>
        
        {isExpanded && (
          <div className="mt-4 border-t pt-3">
            <h4 className="text-sm font-medium mb-2">Why we matched this opportunity:</h4>
            
            {loadingExplanation && (
              <div className="py-2 flex items-center justify-center">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                <span className="ml-2 text-xs">Loading explanation...</span>
              </div>
            )}
            
            {matchExplanation && (
              <ExplanationComponent 
                explanation={matchExplanation} 
                isLoading={false} 
                isPremium={isPremium}
              />
            )}
            
            {!matchExplanation && !loadingExplanation && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={loadMatchExplanation}
                className="w-full text-sm"
              >
                Load explanation
              </Button>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsExpanded(!isExpanded);
            if (!isExpanded) loadMatchExplanation();
          }}
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </Button>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(url, '_blank')}
          >
            <ExternalLink size={16} className="mr-1" />
            Visit
          </Button>
          
          {hasContactMethods && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onContactClick && onContactClick(opportunity)}
            >
              <Mail size={16} className="mr-1" />
              Contact
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

// Using the imported relevanceScoreColor from match-explanation