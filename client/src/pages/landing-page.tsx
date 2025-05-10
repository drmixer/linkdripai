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
      <header className="w-full border-b bg-white sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center">
            <Link href="/">
              <div className="flex items-center cursor-pointer">
                <div className="rounded-md bg-primary p-1.5 mr-2.5">
                  <Link2 className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">LinkDripAI</span>
              </div>
            </Link>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">
              How It Works
            </a>
            <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">
              Pricing
            </a>
            <Link href="/auth?tab=login">
              <span className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">Login</span>
            </Link>
            <Link href="/auth?tab=register&plan=Free+Trial">
              <Button size="sm" className="font-medium px-4">
                Start Free Trial
              </Button>
            </Link>
          </nav>
          
          {/* Mobile menu button - would implement full mobile menu in production */}
          <div className="md:hidden">
            <Button variant="ghost" size="icon" className="text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section with Modern Gradient Background */}
        <section className="relative py-24 lg:py-32 overflow-hidden">
          {/* Background with gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50 to-primary/5 -z-10"></div>
          <div className="absolute top-1/4 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl -z-10"></div>
          <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10"></div>
          
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="lg:w-1/2 space-y-8">
                <div>
                  <div className="inline-flex items-center px-3 py-1 rounded-full gap-x-2 text-sm font-medium bg-primary/10 text-primary mb-4">
                    <span className="h-2 w-2 rounded-full bg-primary"></span>
                    <span>AI-Powered Backlink Prospecting</span>
                  </div>
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-tight">
                  Discover & secure <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">high-quality backlinks</span> on autopilot
                </h1>
                <p className="text-lg text-gray-600 max-w-2xl">
                  LinkDripAI delivers fresh backlink opportunities daily and helps you reach out with personalized AI-generated emails. Save time, increase response rates, and grow your authority.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/auth?tab=register&plan=Free+Trial">
                    <Button size="lg" className="px-8 py-6 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-500 shadow-md hover:shadow-lg transition-all duration-200">
                      Start 7-Day Free Trial
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <a href="#pricing">
                    <Button variant="outline" size="lg" className="px-8 py-6 border-primary text-primary hover:bg-primary/5">
                      View Pricing Plans
                    </Button>
                  </a>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                    <span>No credit card required</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                    <span>Cancel anytime</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                    <span>5 free opportunities/day</span>
                  </div>
                </div>
              </div>
              
              {/* Hero image with floating elements */}
              <div className="lg:w-1/2 relative">
                <div className="relative rounded-xl overflow-hidden shadow-xl">
                  {/* Gradient border effect */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-purple-500/20 to-blue-400/30 rounded-xl p-0.5">
                    <div className="rounded-[0.7rem] overflow-hidden">
                      <img
                        src="https://i.imgur.com/r9UPSWq.png"
                        alt="LinkDripAI Dashboard"
                        className="w-full rounded-lg bg-white"
                      />
                    </div>
                  </div>
                  
                  {/* Floating elements */}
                  <div className="absolute -top-4 -right-4 bg-white p-3 rounded-lg shadow-lg flex items-center gap-2 border border-gray-100">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-medium">Response Rate</div>
                      <div className="text-sm font-bold text-gray-900">+42% Increase</div>
                    </div>
                  </div>
                  
                  <div className="absolute -bottom-4 -left-4 bg-white p-3 rounded-lg shadow-lg flex items-center gap-2 border border-gray-100">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                      <Link2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-medium">New Backlinks</div>
                      <div className="text-sm font-bold text-gray-900">12 this week</div>
                    </div>
                  </div>
                </div>
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
                    <Zap size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Splash Feature</h3>
                  <p className="text-gray-600 mb-4">
                    Gain instant access to new quality opportunities whenever you need them with our Splash feature.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Open access to all opportunity details</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Monthly Splash allowance by plan</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Add-on Splash packages available</span>
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
        <section id="pricing" className="py-20 relative overflow-hidden">
          {/* Background with gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-primary/5 -z-10"></div>
          <div className="absolute top-0 left-1/3 w-96 h-96 bg-blue-100/20 rounded-full blur-3xl -z-10"></div>
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-100/30 rounded-full blur-3xl -z-10"></div>
          
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center px-4 py-1.5 rounded-full gap-x-2 text-sm font-medium bg-primary/10 text-primary mb-4">
                <span className="h-2 w-2 rounded-full bg-primary"></span>
                <span>Simple, Transparent Pricing</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Choose Your Perfect Plan</h2>
              <p className="text-lg text-gray-600">
                Start with a free trial, then pick the package that works best for your backlink building needs
              </p>
            </div>

            <div className="flex justify-center mb-16">
              <div className="inline-flex items-center p-1.5 bg-white rounded-full border shadow-sm">
                <button
                  onClick={() => setPricingInterval("monthly")}
                  className={`px-8 py-2.5 text-sm font-medium rounded-full transition-all duration-200 ${
                    pricingInterval === "monthly" ? "bg-primary text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setPricingInterval("annual")}
                  className={`flex items-center px-8 py-2.5 text-sm font-medium rounded-full transition-all duration-200 ${
                    pricingInterval === "annual" ? "bg-primary text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Annual
                  {pricingInterval !== "annual" && (
                    <span className="ml-2 text-xs font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Save 20%</span>
                  )}
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
              {/* Free Trial */}
              <Card className="relative border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 bg-white">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gray-200"></div>
                <CardContent className="pt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Free Trial</h3>
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">7 Days</span>
                  </div>
                  <p className="text-gray-500 mb-6 text-sm">Try our platform with no commitment</p>
                  <div className="mb-8">
                    <div className="flex items-baseline">
                      <span className="text-4xl font-bold text-gray-900">$0</span>
                      <span className="text-gray-500 ml-1 text-sm">/7 days</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">No credit card required</p>
                  </div>

                  <ul className="space-y-3 mb-8">
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-gray-700" />
                      </div>
                      <span className="text-sm text-gray-600">5 daily AI-matched opportunities</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-gray-700" />
                      </div>
                      <span className="text-sm text-gray-600">Open access to all opportunity details</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-gray-700" />
                      </div>
                      <span className="text-sm text-gray-600">1 Splash for instant opportunities</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-gray-700" />
                      </div>
                      <span className="text-sm text-gray-600">1 website</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-gray-700" />
                      </div>
                      <span className="text-sm text-gray-600">AI email generation</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="px-6 pb-6 pt-0">
                  <Link href="/auth?tab=register&plan=Free+Trial" className="w-full">
                    <Button variant="outline" className="w-full h-11 font-medium border-gray-300">
                      Start Free Trial
                    </Button>
                  </Link>
                </CardFooter>
              </Card>

              {/* Starter Plan */}
              <Card className="relative border-primary rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all duration-200 scale-105 z-10 bg-white">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary to-primary-light"></div>
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-primary to-primary-light text-white text-xs px-4 py-1 rounded-full font-medium">
                  Most Popular
                </div>
                <CardContent className="pt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Starter</h3>
                    <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">Best Value</span>
                  </div>
                  <p className="text-gray-500 mb-6 text-sm">Perfect for small businesses and bloggers</p>
                  <div className="mb-8">
                    <div className="flex items-baseline">
                      <span className="text-4xl font-bold text-gray-900">${pricingInterval === "monthly" ? "9" : "7"}</span>
                      <span className="text-gray-500 ml-1 text-sm">/month</span>
                    </div>
                    {pricingInterval === "annual" && (
                      <div className="flex items-center mt-1">
                        <span className="text-xs text-green-600 font-medium">Save $24/year</span>
                        <span className="text-xs text-gray-500 ml-1">($84 billed annually)</span>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8">
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600">1 website</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600"><span className="font-medium">10 opportunities</span>/day</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600">Open access to all opportunity details</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600"><span className="font-medium">1 Splash</span> for instant opportunities</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600">Basic AI Fit Scoring</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600">AI email generation</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="px-6 pb-6 pt-0">
                  <Link href="/auth?tab=register&plan=Starter" className="w-full">
                    <Button className="w-full h-11 font-medium bg-gradient-to-r from-primary to-primary-light hover:from-primary/90 hover:to-primary-light/90 shadow-sm">
                      Get Started
                    </Button>
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
                    <span className="text-4xl font-bold text-gray-900">${pricingInterval === "monthly" ? "19" : "15"}</span>
                    <span className="text-gray-600 ml-1">/month</span>
                    {pricingInterval === "annual" && <div className="mt-1 text-xs text-primary font-medium">Billed annually (${15*12}/year)</div>}
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
                      <span className="text-sm text-gray-600">7-10 drips/day</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <span className="text-sm text-gray-600">Open access to all opportunity details</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <span className="text-sm text-gray-600"><span className="font-medium">3 Splashes</span>/month</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <span className="text-sm text-gray-600">Advanced filters & analytics</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <span className="text-sm text-gray-600">Follow-up email template</span>
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
                    <span className="text-4xl font-bold text-gray-900">${pricingInterval === "monthly" ? "39" : "31"}</span>
                    <span className="text-gray-600 ml-1">/month</span>
                    {pricingInterval === "annual" && <div className="mt-1 text-xs text-primary font-medium">Billed annually (${31*12}/year)</div>}
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
                      <span className="text-sm text-gray-600">10-15 drips/day</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                      <span className="text-sm text-gray-600">Open access to all opportunity details</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                      <span className="text-sm text-gray-600"><span className="font-medium">7 Splashes</span>/month</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                      <span className="text-sm text-gray-600">Full filters & detailed analytics</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                      <span className="text-sm text-gray-600">Priority support + team seat</span>
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