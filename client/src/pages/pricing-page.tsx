import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Link2, Check } from "lucide-react";

// Pricing plans
const pricingPlans = [
  {
    id: "Free Trial",
    name: "Free Trial",
    price: "Free",
    description: "Try out our platform for 7 days",
    features: [
      "5 opportunities per day",
      "10 credits",
      "1 website",
      "Basic email templates",
    ],
  },
  {
    id: "Starter",
    name: "Starter",
    price: "$39",
    description: "Perfect for individuals and small websites",
    features: [
      "10 opportunities per day",
      "50 credits per month",
      "1 website",
      "Custom email templates",
      "Email tracking",
    ],
  },
  {
    id: "Grow",
    name: "Grow",
    price: "$69",
    description: "For growing websites and small businesses",
    features: [
      "20 opportunities per day",
      "150 credits per month",
      "2 websites",
      "Advanced opportunity filtering",
      "Response rate analytics",
    ],
  },
  {
    id: "Pro",
    name: "Pro",
    price: "$129",
    description: "For serious SEO professionals and agencies",
    features: [
      "30 opportunities per day",
      "300 credits per month",
      "5 websites",
      "Priority support",
      "White label reporting",
    ],
  },
];

export default function PricingPage() {
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string>("Free Trial");
  const [_, navigate] = useLocation();
  
  // Redirect to dashboard if already logged in
  if (user) {
    navigate("/dashboard");
    return null;
  }
  
  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
  };
  
  const handleContinue = () => {
    // Navigate to auth page with selected plan and register tab as default
    navigate(`/auth?plan=${selectedPlan}&tab=register`);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="w-full border-b bg-white">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary p-1.5">
              <Link2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">LinkSyncOS</span>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/auth?tab=login")}
            >
              Log in
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 bg-gray-50">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <h1 className="text-3xl font-bold mb-4">Choose Your Plan</h1>
            <p className="text-gray-600 max-w-lg mx-auto">
              Select the plan that best fits your needs. You can upgrade or downgrade at any time during or after your trial.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingPlans.map((plan) => (
              <Card 
                key={plan.id}
                className={`overflow-hidden transition-all cursor-pointer ${
                  selectedPlan === plan.id 
                    ? "border-primary ring-2 ring-primary ring-opacity-50" 
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => handlePlanSelect(plan.id)}
              >
                <div className="p-1 bg-primary w-full">
                  {selectedPlan === plan.id && (
                    <div className="text-white text-xs text-center font-medium py-0.5">
                      Selected
                    </div>
                  )}
                </div>
                <CardContent className="p-6">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <p className="text-sm text-gray-500">{plan.description}</p>
                  </div>
                  <div className="mb-6">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.id !== "Free Trial" && <span className="text-sm text-gray-500">/month</span>}
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm">
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="p-6 pt-0">
                  <Button 
                    variant={selectedPlan === plan.id ? "default" : "outline"} 
                    className="w-full"
                    onClick={() => handlePlanSelect(plan.id)}
                  >
                    {selectedPlan === plan.id ? "Selected" : "Select Plan"}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          
          <div className="mt-12 text-center">
            <Button 
              size="lg" 
              className="px-8"
              onClick={handleContinue}
            >
              Continue with {selectedPlan}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}