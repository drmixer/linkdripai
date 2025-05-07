import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Icons } from "@/lib/icons";
import { Check, Link2, Zap, BarChart, Mail, Shield, CheckCircle, ArrowRight } from "lucide-react";

export default function LandingPage() {
  const { user } = useAuth();
  const [pricingInterval, setPricingInterval] = useState<"monthly" | "annual">("monthly");

  // Redirect to dashboard if already logged in
  if (user) {
    return <Link href="/dashboard" />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="w-full border-b bg-white">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary p-1.5">
              <Link2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">LinkDripAI</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">How it Works</a>
            <a href="#pricing" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/auth?tab=login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/auth?tab=register&plan=Free+Trial">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 lg:py-32 overflow-hidden bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="lg:w-1/2 space-y-8">
                <div>
                  <div className="inline-flex items-center px-3 py-1 rounded-full gap-x-2 text-sm bg-primary/10 text-primary mb-4">
                    <span className="h-2 w-2 rounded-full bg-primary"></span>
                    <span>Backlink Opportunities & AI Email Outreach</span>
                  </div>
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900">
                  Discover, Manage & <span className="text-primary">Reach Out</span> to High-Quality Backlink Opportunities
                </h1>
                <p className="text-lg text-gray-600 max-w-2xl">
                  LinkDripAI helps you find relevant backlink prospects, manage your outreach, and secure high-authority links with AI-powered email sequences. Boost your SEO results with less effort.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/auth?tab=register&plan=Free+Trial">
                    <Button size="lg" className="px-8 py-6">
                      Start Free Trial
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <a href="#how-it-works">
                    <Button variant="outline" size="lg" className="px-8 py-6">
                      How It Works
                    </Button>
                  </a>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>No credit card required</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>7-day free trial</span>
                  </div>
                </div>
              </div>
              <div className="lg:w-1/2 relative">
                <div className="rounded-xl border bg-white shadow-lg overflow-hidden">
                  <img
                    src="https://i.imgur.com/r9UPSWq.png"
                    alt="LinkDripAI Dashboard"
                    className="w-full rounded-lg"
                  />
                </div>
                <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-primary/10 rounded-full"></div>
                <div className="absolute -top-6 -right-6 w-32 h-32 bg-primary/10 rounded-full"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-12 bg-white border-y">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-gray-900">10,000+</div>
                <div className="text-sm text-gray-600">Backlinks Secured</div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-gray-900">5,000+</div>
                <div className="text-sm text-gray-600">Happy Users</div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-gray-900">40%</div>
                <div className="text-sm text-gray-600">Avg. Response Rate</div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-gray-900">50+</div>
                <div className="text-sm text-gray-600">DA Average</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Powerful Features</h2>
              <p className="text-lg text-gray-600">
                Everything you need to supercharge your backlink acquisition efforts in one platform
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <Card className="flex flex-col h-full border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="flex-1 pt-6">
                  <div className="p-2 w-12 h-12 rounded-lg bg-primary/10 text-primary mb-5">
                    <Link2 size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Daily Fresh Opportunities</h3>
                  <p className="text-gray-600 mb-4">
                    Receive a daily feed of carefully vetted backlink prospects tailored to your niche and preferences.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Domains with high authority</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Niche-relevant websites</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Verified contact information</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="flex flex-col h-full border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="flex-1 pt-6">
                  <div className="p-2 w-12 h-12 rounded-lg bg-primary/10 text-primary mb-5">
                    <Zap size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">AI-Powered Email Outreach</h3>
                  <p className="text-gray-600 mb-4">
                    Generate personalized, high-converting outreach emails with our advanced AI technology.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Smart personalization</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Multiple templates by goal</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Automated follow-ups</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="flex flex-col h-full border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="flex-1 pt-6">
                  <div className="p-2 w-12 h-12 rounded-lg bg-primary/10 text-primary mb-5">
                    <BarChart size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Comprehensive Analytics</h3>
                  <p className="text-gray-600 mb-4">
                    Track your outreach performance with detailed metrics and insights to improve your strategy.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Response rate tracking</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Backlink acquisition reporting</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Domain authority distribution</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="flex flex-col h-full border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="flex-1 pt-6">
                  <div className="p-2 w-12 h-12 rounded-lg bg-primary/10 text-primary mb-5">
                    <Mail size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Email Integration</h3>
                  <p className="text-gray-600 mb-4">
                    Send emails directly through Gmail, Outlook, or your preferred email provider with seamless integration.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Gmail and Outlook support</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Email tracking and notifications</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">SMTP support</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="flex flex-col h-full border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="flex-1 pt-6">
                  <div className="p-2 w-12 h-12 rounded-lg bg-primary/10 text-primary mb-5">
                    <Shield size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Prospect Management</h3>
                  <p className="text-gray-600 mb-4">
                    Organize and manage your prospects with a powerful system designed for link builders.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Save and categorize prospects</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Outreach status tracking</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Notes and collaboration tools</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="flex flex-col h-full border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="flex-1 pt-6">
                  <div className="p-2 w-12 h-12 rounded-lg bg-primary/10 text-primary mb-5">
                    <Icons.creditCard size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Credit System</h3>
                  <p className="text-gray-600 mb-4">
                    Use credits to unlock prospect contact details and access premium features as you need them.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Flexible credit packages</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Monthly credit allowance</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Credit usage analytics</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* How it Works Section */}
        <section id="how-it-works" className="py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">How LinkDripAI Works</h2>
              <p className="text-lg text-gray-600">
                A simple, effective process to help you secure high-quality backlinks with minimal effort
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center mx-auto mb-4 text-xl font-bold">1</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Discover Opportunities</h3>
                <p className="text-gray-600">
                  Browse through your daily feed of fresh backlink prospects tailored to your niche and preferences.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center mx-auto mb-4 text-xl font-bold">2</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Create Personalized Outreach</h3>
                <p className="text-gray-600">
                  Use AI to generate highly personalized emails or choose from proven templates to reach out.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center mx-auto mb-4 text-xl font-bold">3</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Track & Secure Backlinks</h3>
                <p className="text-gray-600">
                  Monitor your campaign performance, follow up automatically, and secure high-quality backlinks.
                </p>
              </div>
            </div>

            <div className="mt-16 text-center">
              <Link href="/auth">
                <Button size="lg" className="px-8 py-6">
                  Get Started Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
              <p className="text-lg text-gray-600">
                Choose the right plan for your link building needs with flexible options to scale
              </p>
            </div>

            <div className="flex justify-center mb-10">
              <div className="inline-flex items-center p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setPricingInterval("monthly")}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    pricingInterval === "monthly" ? "bg-white shadow-sm" : "text-gray-600"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setPricingInterval("annual")}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    pricingInterval === "annual" ? "bg-white shadow-sm" : "text-gray-600"
                  }`}
                >
                  Annual <span className="text-xs text-primary">Save 20%</span>
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Free Trial */}
              <Card className="relative border-gray-200">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Free Trial</h3>
                  <p className="text-gray-600 mb-6">Try our platform with no commitment</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">$0</span>
                    <span className="text-gray-600">/7 days</span>
                  </div>

                  <ul className="space-y-3 mb-6">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">5 opportunities/day drip</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Max 10 total credits</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Max 2 credits per day</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">AI email generation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">No rollover</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link href="/auth?tab=register&plan=Free+Trial" className="w-full">
                    <Button variant="outline" className="w-full">Start Free Trial</Button>
                  </Link>
                </CardFooter>
              </Card>

              {/* Starter Plan */}
              <Card className="relative border-primary">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-primary text-white text-xs px-4 py-1 rounded-full">
                  Most Popular
                </div>
                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Starter</h3>
                  <p className="text-gray-600 mb-6">Perfect for small businesses starting with link building</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">${pricingInterval === "monthly" ? "39" : "31"}</span>
                    <span className="text-gray-600">/month</span>
                    {pricingInterval === "annual" && <span className="ml-2 text-xs text-primary">billed annually</span>}
                  </div>

                  <ul className="space-y-3 mb-6">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">1 website</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">10 opportunities/day drip</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">50 credits/month</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">1-month credit rollover</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Basic AI Fit Scoring</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Free email generation</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link href="/auth?tab=register&plan=Starter" className="w-full">
                    <Button className="w-full">Get Started</Button>
                  </Link>
                </CardFooter>
              </Card>

              {/* Grow Plan */}
              <Card className="relative border-gray-200">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Grow</h3>
                  <p className="text-gray-600 mb-6">For growing businesses with active link building</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">${pricingInterval === "monthly" ? "69" : "55"}</span>
                    <span className="text-gray-600">/month</span>
                    {pricingInterval === "annual" && <span className="ml-2 text-xs text-primary">billed annually</span>}
                  </div>

                  <ul className="space-y-3 mb-6">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Up to 2 websites</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">20 opportunities/day drip</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">150 credits/month</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">1-month credit rollover</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Advanced AI recommendations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Multi-site dashboard</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link href="/auth?tab=register&plan=Grow" className="w-full">
                    <Button variant="outline" className="w-full">Get Started</Button>
                  </Link>
                </CardFooter>
              </Card>
              
              {/* Pro Plan */}
              <Card className="relative border-gray-200">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Pro</h3>
                  <p className="text-gray-600 mb-6">For agencies and serious link builders</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">${pricingInterval === "monthly" ? "129" : "103"}</span>
                    <span className="text-gray-600">/month</span>
                    {pricingInterval === "annual" && <span className="ml-2 text-xs text-primary">billed annually</span>}
                  </div>

                  <ul className="space-y-3 mb-6">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Up to 5 websites</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">30 opportunities/day drip</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">300 credits/month</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">1-month credit rollover</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Advanced AI recommendations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Priority support</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link href="/auth?tab=register&plan=Pro" className="w-full">
                    <Button variant="outline" className="w-full">Get Started</Button>
                  </Link>
                </CardFooter>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-primary">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-6">Ready to supercharge your link building?</h2>
              <p className="text-xl text-white/90 mb-8">
                Join thousands of satisfied users who are building high-quality backlinks faster and more efficiently than ever before.
              </p>
              <Link href="/auth?tab=register&plan=Free+Trial">
                <Button size="lg" variant="secondary" className="px-10 py-6">
                  Start Your Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <p className="mt-4 text-sm text-white/80">No credit card required. 7-day free trial.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-lg mb-4">Product</h3>
              <ul className="space-y-2">
                <li><a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="text-gray-400 hover:text-white transition-colors">How it Works</a></li>
                <li><a href="#pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</a></li>
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
                <Link2 className="h-5 w-5 text-white" />
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