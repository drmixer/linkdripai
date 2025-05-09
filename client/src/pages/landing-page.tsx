import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Icons } from "@/lib/icons";
import { Check, CheckCircle, ArrowRight, Link2, Zap, BarChart, Mail, Shield } from "lucide-react";

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
      <header className="w-full border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center">
            <Link href="/">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-primary mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 9L12 5M12 5L16 9M12 5V15M8 19H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-xl font-bold text-primary">LinkDripAI</span>
              </div>
            </Link>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/pricing">
              <span className="text-sm text-gray-600 hover:text-primary transition-colors">Pricing</span>
            </Link>
            <Link href="/blog">
              <span className="text-sm text-gray-600 hover:text-primary transition-colors">Blog</span>
            </Link>
            <Link href="/contact">
              <span className="text-sm text-gray-600 hover:text-primary transition-colors">Contact</span>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-gray-600">Dashboard</Button>
            </Link>
            <Link href="/auth?tab=login">
              <Button variant="ghost" size="sm" className="text-gray-600">Settings</Button>
            </Link>
            <Link href="/auth?tab=login">
              <Button variant="ghost" size="sm" className="text-gray-600">Logout</Button>
            </Link>
          </nav>
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
                    <Button size="lg" className="px-8 py-6 shadow-md hover:shadow-lg transition-all duration-200">
                      Start Free Trial
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <a href="#pricing">
                    <Button variant="outline" size="lg" className="px-8 py-6 border-primary text-primary hover:bg-primary/5">
                      View Pricing
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
        <section id="pricing" className="py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <div className="inline-flex items-center px-4 py-1.5 rounded-full gap-x-2 text-sm bg-primary/10 text-primary mb-4">
                <span className="h-2 w-2 rounded-full bg-primary"></span>
                <span>Plans & Pricing</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
              <p className="text-lg text-gray-600">
                Choose the right plan for your link building needs with flexible options to scale
              </p>
            </div>

            <div className="flex justify-center mb-12">
              <div className="inline-flex items-center p-1 bg-white rounded-lg border shadow-sm">
                <button
                  onClick={() => setPricingInterval("monthly")}
                  className={`px-6 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    pricingInterval === "monthly" ? "bg-primary text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setPricingInterval("annual")}
                  className={`px-6 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    pricingInterval === "annual" ? "bg-primary text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Annual <span className="ml-1 text-xs font-bold">{pricingInterval === "annual" ? "" : "Save 20%"}</span>
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Free Trial */}
              <Card className="relative border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                <div className="absolute inset-x-0 top-0 h-2 bg-gray-200"></div>
                <CardContent className="pt-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Free Trial</h3>
                  <p className="text-gray-500 mb-6 text-sm">Try our platform with no commitment</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">$0</span>
                    <span className="text-gray-600 ml-1">/7 days</span>
                  </div>

                  <ul className="space-y-3 mb-6">
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600">5 opportunities/day drip</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600">Max 10 total credits</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600">Max 2 credits per day</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600">AI email generation</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600">No rollover</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="px-6 pb-6 pt-0">
                  <Link href="/auth?tab=register&plan=Free+Trial" className="w-full">
                    <Button variant="outline" className="w-full h-11 font-medium">Start Free Trial</Button>
                  </Link>
                </CardFooter>
              </Card>

              {/* Starter Plan */}
              <Card className="relative border-primary-200 overflow-hidden shadow-md hover:shadow-lg transition-all duration-200 scale-105 z-10 bg-white">
                <div className="absolute inset-x-0 top-0 h-2 bg-primary"></div>
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-primary text-white text-xs px-4 py-1 rounded-full font-medium">
                  Most Popular
                </div>
                <CardContent className="pt-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Starter</h3>
                  <p className="text-gray-500 mb-6 text-sm">Perfect for small businesses starting with link building</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">${pricingInterval === "monthly" ? "39" : "31"}</span>
                    <span className="text-gray-600 ml-1">/month</span>
                    {pricingInterval === "annual" && <div className="mt-1 text-xs text-primary font-medium">Billed annually (${31*12}/year)</div>}
                  </div>

                  <ul className="space-y-3 mb-6">
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600">1 website</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600">10 opportunities/day drip</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600">50 credits/month</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600">1-month credit rollover</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600">Basic AI Fit Scoring</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600">Free email generation</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="px-6 pb-6 pt-0">
                  <Link href="/auth?tab=register&plan=Starter" className="w-full">
                    <Button className="w-full h-11 shadow-sm font-medium">Get Started</Button>
                  </Link>
                </CardFooter>
              </Card>

              {/* Grow Plan */}
              <Card className="relative border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                <div className="absolute inset-x-0 top-0 h-2 bg-blue-400"></div>
                <CardContent className="pt-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Grow</h3>
                  <p className="text-gray-500 mb-6 text-sm">For growing businesses with active link building</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">${pricingInterval === "monthly" ? "69" : "55"}</span>
                    <span className="text-gray-600 ml-1">/month</span>
                    {pricingInterval === "annual" && <div className="mt-1 text-xs text-primary font-medium">Billed annually (${55*12}/year)</div>}
                  </div>

                  <ul className="space-y-3 mb-6">
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <span className="text-sm text-gray-600">Up to 2 websites</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <span className="text-sm text-gray-600">20 opportunities/day drip</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <span className="text-sm text-gray-600">150 credits/month</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <span className="text-sm text-gray-600">1-month credit rollover</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <span className="text-sm text-gray-600">Advanced AI recommendations</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <span className="text-sm text-gray-600">Multi-site dashboard</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="px-6 pb-6 pt-0">
                  <Link href="/auth?tab=register&plan=Grow" className="w-full">
                    <Button variant="outline" className="w-full h-11 font-medium">Get Started</Button>
                  </Link>
                </CardFooter>
              </Card>
              
              {/* Pro Plan */}
              <Card className="relative border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                <div className="absolute inset-x-0 top-0 h-2 bg-purple-500"></div>
                <CardContent className="pt-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Pro</h3>
                  <p className="text-gray-500 mb-6 text-sm">For agencies and serious link builders</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">${pricingInterval === "monthly" ? "129" : "103"}</span>
                    <span className="text-gray-600 ml-1">/month</span>
                    {pricingInterval === "annual" && <div className="mt-1 text-xs text-primary font-medium">Billed annually (${103*12}/year)</div>}
                  </div>

                  <ul className="space-y-3 mb-6">
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                      <span className="text-sm text-gray-600">Up to 5 websites</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                      <span className="text-sm text-gray-600">30 opportunities/day drip</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                      <span className="text-sm text-gray-600">300 credits/month</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                      <span className="text-sm text-gray-600">1-month credit rollover</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                      <span className="text-sm text-gray-600">Advanced AI recommendations</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                      <span className="text-sm text-gray-600">Priority support</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="px-6 pb-6 pt-0">
                  <Link href="/auth?tab=register&plan=Pro" className="w-full">
                    <Button variant="outline" className="w-full h-11 font-medium">Get Started</Button>
                  </Link>
                </CardFooter>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-gradient-to-br from-primary to-primary-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute right-0 bottom-0 w-80 h-80 rounded-full bg-white/30 -mr-20 -mb-20"></div>
            <div className="absolute left-[10%] top-[20%] w-64 h-64 rounded-full bg-white/20"></div>
            <div className="absolute right-[20%] top-[15%] w-36 h-36 rounded-full bg-white/10"></div>
          </div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Ready to supercharge your link building?</h2>
              <p className="text-xl text-white/90 mb-10 max-w-3xl mx-auto">
                Join thousands of satisfied users who are building high-quality backlinks faster and more efficiently than ever before.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-6">
                <Link href="/auth?tab=register&plan=Free+Trial">
                  <Button size="lg" variant="secondary" className="px-10 py-6 text-primary font-medium shadow-xl hover:shadow-2xl transition-all duration-200 text-lg">
                    Start Your Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/auth?tab=login">
                  <Button size="lg" variant="outline" className="px-10 py-6 bg-transparent text-white border-white/30 hover:bg-white/10 transition-all duration-200 text-lg">
                    Log In
                  </Button>
                </Link>
              </div>
              <p className="mt-6 text-sm text-white/80 font-medium">No credit card required. 7-day free trial.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between mb-12">
            <div className="mb-8 md:mb-0">
              <Link href="/">
                <div className="flex items-center mb-6">
                  <div className="rounded-md bg-primary/90 p-2 mr-2">
                    <Link2 className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xl font-bold">LinkDripAI</span>
                </div>
              </Link>
              <p className="text-gray-400 max-w-xs mb-6">
                Advanced AI-powered backlink prospecting and outreach platform for SEO professionals and digital marketers.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-primary/80 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-primary/80 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-primary/80 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                </a>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 lg:gap-16">
              <div>
                <h3 className="font-bold text-lg mb-4">Product</h3>
                <ul className="space-y-3">
                  <li><a href="#features" className="text-gray-400 hover:text-white transition-colors text-sm">Features</a></li>
                  <li><a href="#how-it-works" className="text-gray-400 hover:text-white transition-colors text-sm">How it Works</a></li>
                  <li><a href="#pricing" className="text-gray-400 hover:text-white transition-colors text-sm">Pricing</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-4">Resources</h3>
                <ul className="space-y-3">
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Blog</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Help Center</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Contact Support</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-4">Company</h3>
                <ul className="space-y-3">
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">About Us</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Privacy Policy</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Terms of Service</a></li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Privacy</a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Terms</a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Cookies</a>
            </div>
            <p className="text-gray-400 text-sm">© {new Date().getFullYear()} LinkDripAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}