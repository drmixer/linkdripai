import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ExternalLink, 
  Info,
  Star
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface DripOpportunityCardProps {
  opportunity: any;
  websiteId: number;
  onContactClick?: (opportunity: any) => void;
}

export default function DripOpportunityCard({ 
  opportunity,
  websiteId,
  onContactClick
}: DripOpportunityCardProps) {
  
  // Get color based on DA score
  const getDaColor = (score: number) => {
    if (score >= 50) return "text-green-600";
    if (score >= 30) return "text-amber-600";
    return "text-gray-600";
  }
  
  // Get color based on relevance score
  const getRelevanceColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-gray-600";
  }
  
  // Get color based on spam score
  const getSpamColor = (score: number) => {
    if (score <= 1) return "text-green-600";
    if (score <= 3) return "text-amber-600";
    return "text-red-600";
  }
  
  // Get quality badge
  const getQualityBadge = () => {
    if (opportunity.domainAuthority >= 40 && opportunity.relevanceScore >= 80 && opportunity.spamScore <= 2) {
      return <Badge className="bg-purple-100 text-purple-800">Premium</Badge>
    }
    if (opportunity.domainAuthority >= 30 && opportunity.relevanceScore >= 70) {
      return <Badge className="bg-green-100 text-green-800">High</Badge>
    }
    if (opportunity.domainAuthority >= 20 && opportunity.relevanceScore >= 60) {
      return <Badge variant="outline" className="border-amber-500 text-amber-700">Medium</Badge>
    }
    return <Badge variant="outline">Standard</Badge>
  }
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 truncate">
            <CardTitle className="text-lg font-semibold mb-1 truncate">
              {opportunity.title || opportunity.domain || 'Unknown Site'}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <a 
                href={opportunity.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center hover:text-primary truncate max-w-[200px]"
              >
                {opportunity.url}
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
          </div>
          
          <div className="ml-2 flex-shrink-0">
            {getQualityBadge()}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 bg-gray-50 rounded-md">
            <div className={`text-lg font-bold ${getDaColor(opportunity.domainAuthority)}`}>
              {opportunity.domainAuthority || '?'}
            </div>
            <div className="text-xs text-gray-500">Domain Auth.</div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded-md">
            <div className={`text-lg font-bold ${getRelevanceColor(opportunity.relevanceScore)}`}>
              {opportunity.relevanceScore ? `${opportunity.relevanceScore}%` : '?'}
            </div>
            <div className="text-xs text-gray-500">Relevance</div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded-md">
            <div className={`text-lg font-bold ${getSpamColor(opportunity.spamScore)}`}>
              {opportunity.spamScore !== undefined ? opportunity.spamScore : '?'}
            </div>
            <div className="text-xs text-gray-500">Spam Score</div>
          </div>
        </div>
        
        <div className="mt-auto">
          <div className="flex justify-between pt-2 border-t">
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex-1 mr-1"
              onClick={() => {
                // Save opportunity to favorites
                fetch(`/api/opportunities/${opportunity.id}/favorite`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ websiteId })
                })
                .then(res => {
                  if (res.ok) {
                    toast({
                      title: "Opportunity saved",
                      description: "This opportunity has been saved to your favorites.",
                    });
                  } else {
                    throw new Error("Failed to save opportunity");
                  }
                })
                .catch(err => {
                  toast({
                    title: "Error saving opportunity",
                    description: "There was a problem saving this opportunity.",
                    variant: "destructive"
                  });
                });
              }}
            >
              <Star className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex-1 ml-1"
              onClick={() => onContactClick && onContactClick(opportunity)}
            >
              <Info className="h-4 w-4 mr-2" />
              Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}