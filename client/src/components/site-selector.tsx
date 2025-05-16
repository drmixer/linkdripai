import { useState, useEffect } from "react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Globe } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function SiteSelector() {
  const [selectedWebsite, setSelectedWebsite] = useState<string>("all");
  
  // Fetch websites
  const { data: websites } = useQuery({
    queryKey: ["/api/websites"],
  });
  
  // Set the website in localStorage for persistence
  const handleWebsiteChange = (websiteId: string) => {
    setSelectedWebsite(websiteId);
    localStorage.setItem("selectedWebsite", websiteId);
  };
  
  // On initial load, check if we have a saved website
  useEffect(() => {
    const saved = localStorage.getItem("selectedWebsite");
    if (saved) {
      setSelectedWebsite(saved);
    }
  }, []);

  return (
    <div className="flex items-center space-x-2">
      <Select value={selectedWebsite} onValueChange={handleWebsiteChange}>
        <SelectTrigger className="w-[240px]">
          <div className="flex items-center">
            <Globe className="w-4 h-4 mr-2" />
            {selectedWebsite === "all" ? (
              <span>All Websites</span>
            ) : (
              <span>
                {websites?.find((site: any) => site.id.toString() === selectedWebsite)?.url || "Select Website"}
              </span>
            )}
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Websites</SelectItem>
          {websites && websites.map((site: any) => (
            <SelectItem key={site.id} value={site.id.toString()}>
              {site.url}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}