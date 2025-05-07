import { useState } from "react";
import { Link } from "wouter";
import { Check, ArrowRight, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function PricingPage() {
  const [pricingInterval, setPricingInterval] = useState<"monthly" | "annual">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<"Free Trial" | "Starter" | "Grow" | "Pro">("Free Trial");

  const plans = [
    {
      id: "free-trial",
      name: "Free Trial",
      description: "Try LinkDripAI free for 7 days",
      price: "0",
      features: [
        "5 daily opportunities",
        "10 total credits",
        "1 website",
        "Basic analytics",
        "Email generation"
      ]
    },
    {
      id: "starter",
      name: "Starter",
      description: "Perfect for solo site owners",
      price: pricingInterval === "monthly" ? "39" : "31",
      features: [
        "10 daily opportunities",
        "50 credits/month",
        "1 website",
        "Full analytics",
        "Email tracking",
        "Credit rollover"
      ]
    },
    {
      id: "grow",
      name: "Grow",
      description: "For growing businesses",
      price: pricingInterval === "monthly" ? "69" : "55",
      features: [
        "20 daily opportunities",
        "150 credits/month",
        "2 websites",
        "Advanced analytics",
        "Email automation",
        "Credit rollover",
        "Multi-site dashboard"
      ]
    },
    {
      id: "pro",
      name: "Pro",
      description: "For agencies and serious link builders",
      price: pricingInterval === "monthly" ? "129" : "103",
      features: [
        "30 daily opportunities",
        "300 credits/month",
        "5 websites",
        "1-month credit rollover",
        "Advanced AI recommendations",
        "Priority support"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <div className="rounded-md bg-primary p-1.5 mr-2">
                <LinkIcon className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">LinkDripAI</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/auth">
                <Button variant="outline">Login</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose the Right Plan for Your Link Building Needs
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            All plans include our AI-powered link prospecting, email generation, and outreach tools.
          </p>

          {/* Pricing Toggle */}
          <div className="flex items-center justify-center mb-10">
            <Label htmlFor="pricing-toggle" className={`mr-2 text-sm ${pricingInterval === "monthly" ? "text-gray-900 font-medium" : "text-gray-500"}`}>
              Monthly
            </Label>
            <Switch
              id="pricing-toggle"
              checked={pricingInterval === "annual"}
              onCheckedChange={(checked) => setPricingInterval(checked ? "annual" : "monthly")}
              className="mx-2"
            />
            <Label htmlFor="pricing-toggle" className={`ml-2 text-sm ${pricingInterval === "annual" ? "text-gray-900 font-medium" : "text-gray-500"}`}>
              Annual <span className="text-primary text-xs font-medium">Save 20%</span>
            </Label>
          </div>
        </div>

        {/* Plan Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`border-2 ${selectedPlan === plan.name ? "border-primary" : "border-gray-200"} transition-all hover:shadow-md`}
              onClick={() => setSelectedPlan(plan.name as "Free Trial" | "Starter" | "Grow" | "Pro")}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                  </div>
                  <RadioGroup value={selectedPlan} onValueChange={(value) => setSelectedPlan(value as "Free Trial" | "Starter" | "Grow" | "Pro")}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value={plan.name} id={plan.id} />
                    </div>
                  </RadioGroup>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <span className="text-3xl font-bold">${plan.price}</span>
                  {plan.name !== "Free Trial" && (
                    <span className="text-gray-500">/month</span>
                  )}
                  {pricingInterval === "annual" && plan.name !== "Free Trial" && (
                    <span className="ml-2 text-xs text-primary">billed annually</span>
                  )}
                </div>
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Link href={`/auth?tab=register&plan=${encodeURIComponent(plan.name)}`} className="w-full">
                  <Button 
                    variant={selectedPlan === plan.name ? "default" : "outline"} 
                    className="w-full"
                  >
                    {plan.name === "Free Trial" ? "Start Free Trial" : "Get Started"}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mt-20">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">What are credits used for?</h3>
              <p className="text-gray-600">Credits are used when you unlock detailed information about prospects, generate AI-powered outreach emails, and access advanced analytics. Each action costs a certain number of credits.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-2">Can I change plans later?</h3>
              <p className="text-gray-600">Yes, you can upgrade or downgrade your plan at any time. When upgrading, you'll get immediate access to the new features and limits. When downgrading, changes will take effect on your next billing cycle.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-2">What happens after my free trial ends?</h3>
              <p className="text-gray-600">After your 7-day free trial, you'll be prompted to select a paid plan to continue using LinkDripAI. Don't worry - we'll remind you before your trial ends and no credit card is required to start.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-2">Do credits roll over?</h3>
              <p className="text-gray-600">Yes, depending on your plan. Starter and Grow plans allow unused credits to roll over to the next month (up to your monthly allocation). Pro plans offer a full month of credit rollover.</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-16">
          <h2 className="text-2xl font-bold mb-4">Ready to supercharge your link building?</h2>
          <p className="text-lg text-gray-600 mb-6">Get started with a risk-free 7-day trial. No credit card required.</p>
          <Link href="/auth?tab=register&plan=Free Trial">
            <Button size="lg" className="px-8">
              Start Your Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-lg mb-4">Product</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">How it Works</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Contact Support</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Company</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Connect</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Twitter</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">LinkedIn</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Facebook</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="rounded-md bg-primary p-1.5 mr-2">
                <LinkIcon className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">LinkSyncOS</span>
            </div>
            <p className="text-gray-400 text-sm">© {new Date().getFullYear()} LinkSyncOS. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}