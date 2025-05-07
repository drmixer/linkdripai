import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Prospect } from "@shared/schema";
import { Link } from "wouter";

interface OpportunityCardProps {
  prospect: Prospect;
  onUnlock?: () => void;
  onSave?: () => void;
  onEmail?: () => void;
}

export default function OpportunityCard({ 
  prospect, 
  onUnlock, 
  onSave, 
  onEmail 
}: OpportunityCardProps) {
  const { toast } = useToast();
  
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
        title: "Prospect saved",
        description: "You can find this in your saved prospects.",
      });
      if (onSave) onSave();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save prospect",
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
  
  return (
    <div className={`relative bg-white rounded-lg shadow overflow-hidden ${
      prospect.isUnlocked ? "border border-primary-100" : "border border-gray-200"
    }`}>
      {prospect.isUnlocked && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary-500"></div>
      )}
      <div className="absolute top-3 right-3">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <svg className="-ml-0.5 mr-1.5 h-2 w-2 text-green-400" fill="currentColor" viewBox="0 0 8 8">
            <circle cx="4" cy="4" r="3" />
          </svg>
          {prospect.fitScore}% Fit
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-center mb-3">
          {prospect.isUnlocked ? (
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
              {prospect.siteName ? (
                <span className="text-sm font-medium">
                  {prospect.siteName.split(' ').map(word => word[0]).join('').slice(0, 2)}
                </span>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              )}
            </div>
          ) : (
            <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
          )}
          
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900">
              {prospect.isUnlocked ? prospect.siteName : prospect.siteType}
            </h3>
            <p className="text-sm text-gray-500">
              Domain Authority: {prospect.domainAuthority}
            </p>
          </div>
        </div>
        
        <div className="mt-4 space-y-2.5">
          <div className="flex items-center">
            <div className="w-5 h-5 flex-shrink-0 mr-2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <span className="text-sm text-gray-600">Niche: {prospect.niche}</span>
          </div>
          
          {prospect.isUnlocked && prospect.contactEmail && (
            <div className="flex items-center">
              <div className="w-5 h-5 flex-shrink-0 mr-2 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </div>
              <span className="text-sm text-gray-600">Contact: {prospect.contactEmail}</span>
            </div>
          )}
          
          <div className="flex items-center">
            <div className="w-5 h-5 flex-shrink-0 mr-2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm text-gray-600">Type: {prospect.siteType}</span>
          </div>
          
          <div className="flex items-center">
            <div className="w-5 h-5 flex-shrink-0 mr-2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <span className="text-sm text-gray-600">Monthly traffic: ~{prospect.monthlyTraffic}</span>
          </div>
        </div>

        {prospect.isUnlocked ? (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button
              onClick={handleEmail}
              className="flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email
            </Button>
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Save
            </Button>
          </div>
        ) : (
          <div className="mt-5">
            <Button 
              className="w-full flex items-center justify-center"
              onClick={handleUnlock}
              disabled={unlockMutation.isPending}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              {unlockMutation.isPending ? 'Unlocking...' : 'Unlock for 1 credit'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
