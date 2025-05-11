import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Sparkles, BrainCircuit, Target, Info } from "lucide-react";

// Types for match explanation
export interface MatchExplanation {
  reasons: string[];
  score: number;
  metrics: {
    contentRelevance?: number;
    topicMatch?: number;
    keywordDensity?: number;
    linkPotential?: number;
    domainAuthority?: number;
    qualityScore?: number;
    [key: string]: number | undefined;
  };
}

interface MatchExplanationProps {
  explanation: MatchExplanation;
  isLoading: boolean;
  isPremium?: boolean;
}

export function MatchExplanation({ 
  explanation, 
  isLoading,
  isPremium = false
}: MatchExplanationProps) {
  if (isLoading) {
    return (
      <div className="py-2 flex items-center justify-center">
        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-2 text-xs">Analyzing match...</span>
      </div>
    );
  }

  const { reasons, score, metrics } = explanation;
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BrainCircuit size={16} className="text-primary" />
            <span className="text-sm font-medium">AI Match Analysis</span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <Info size={14} className="text-slate-400" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="max-w-xs text-xs">
                  Our AI analyzes multiple factors to determine how well this opportunity matches your website's profile and preferences.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm">Overall Match Score:</span>
          <div className="flex items-center">
            <Badge variant="outline" className={relevanceScoreColor(score)}>
              {score}%
            </Badge>
            {isPremium && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Sparkles size={16} className="ml-2 text-purple-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Premium quality match (80%+ relevance)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        <Progress value={score} className="h-2 mb-3" />
      </div>
      
      {/* Detailed metrics */}
      {Object.keys(metrics).length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {metrics.contentRelevance !== undefined && (
            <MetricItem 
              label="Content Relevance" 
              value={metrics.contentRelevance} 
              tooltip="How closely the opportunity's content matches your website's topics" 
            />
          )}
          {metrics.topicMatch !== undefined && (
            <MetricItem 
              label="Topic Match" 
              value={metrics.topicMatch} 
              tooltip="How well the opportunity's main topics align with your website's focus" 
            />
          )}
          {metrics.keywordDensity !== undefined && (
            <MetricItem 
              label="Keyword Match" 
              value={metrics.keywordDensity} 
              tooltip="Percentage of your target keywords found in the opportunity" 
            />
          )}
          {metrics.linkPotential !== undefined && (
            <MetricItem 
              label="Link Potential" 
              value={metrics.linkPotential} 
              tooltip="Likelihood of securing a backlink based on opportunity type" 
            />
          )}
          {metrics.qualityScore !== undefined && (
            <MetricItem 
              label="Quality Score" 
              value={metrics.qualityScore} 
              tooltip="Overall quality based on domain metrics and content" 
            />
          )}
        </div>
      )}
      
      {/* Reason list */}
      <div className="space-y-1 bg-slate-50 p-3 rounded-md">
        <div className="flex items-center gap-2 mb-2">
          <Target size={14} className="text-primary" />
          <span className="text-sm font-medium">Why we recommended this:</span>
        </div>
        <ul className="text-sm space-y-1.5 list-disc pl-5">
          {reasons.map((reason, i) => (
            <li key={i} className="text-slate-700">{reason}</li>
          ))}
        </ul>
        
        {isPremium && (
          <div className="mt-3 bg-purple-50 p-2 rounded border border-purple-200 flex items-start">
            <AlertCircle size={14} className="text-purple-600 mt-0.5 mr-2 flex-shrink-0" />
            <p className="text-xs text-purple-700">
              This is a premium opportunity with higher potential value for your website.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component for individual metrics
function MetricItem({ 
  label, 
  value, 
  tooltip 
}: { 
  label: string; 
  value: number; 
  tooltip: string 
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 mb-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center text-xs text-slate-500 cursor-help">
                {label} <Info size={10} className="ml-1" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex justify-between mb-1">
        <span className="text-xs font-medium">{value}%</span>
      </div>
      <Progress value={value} className="h-1" />
    </div>
  );
}

// Helper function to get color based on relevance score
export function relevanceScoreColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800';
  if (score >= 60) return 'bg-blue-100 text-blue-800';
  if (score >= 40) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}