import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Check } from "lucide-react";

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
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="text-gray-600">Settings</Button>
            </Link>
            <Link href="/auth?tab=login">
              <Button variant="ghost" size="sm" className="text-gray-600">Logout</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Key Benefits Section */}
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <div className="inline-block px-3 py-1 text-xs font-medium text-primary bg-primary/10 rounded-full mb-4">
                Key Benefits
              </div>
              <h1 className="text-4xl font-bold text-primary mb-4">Why Choose LinkDripAI?</h1>
              <p className="text-gray-600 max-w-2xl mx-auto">
                LinkDripAI empowers you to build high-quality backlinks efficiently, without the usual hassle.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="border border-gray-200 shadow-sm h-full">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="bg-primary/10 p-2 rounded-md mr-3">
                      <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 9L12 5M12 5L16 9M12 5V15M8 19H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-800">Daily Fresh Opportunities</h3>
                  </div>
                  <p className="text-gray-600 text-sm">
                    Never run out of prospects. Get a curated list of new link opportunities dripped to you daily.
                  </p>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 shadow-sm h-full">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="bg-primary/10 p-2 rounded-md mr-3">
                      <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13 10V3L4 14H11V21L20 10H13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-800">Smart Recommendations</h3>
                  </div>
                  <p className="text-gray-600 text-sm">
                    Tailored to your niche, site type, and goals. Our AI finds the best fits for you.
                  </p>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 shadow-sm h-full">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="bg-primary/10 p-2 rounded-md mr-3">
                      <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-800">AI-Generated Emails</h3>
                  </div>
                  <p className="text-gray-600 text-sm">
                    Craft personalized outreach emails in seconds. Unlimited on paid plans.
                  </p>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 shadow-sm h-full">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="bg-primary/10 p-2 rounded-md mr-3">
                      <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-800">No Scraping Needed</h3>
                  </div>
                  <p className="text-gray-600 text-sm">
                    Save time and effort. We handle the discovery, so you can focus on building relationships.
                  </p>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 shadow-sm h-full">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="bg-primary/10 p-2 rounded-md mr-3">
                      <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 14l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-800">Manage & Filter Outreach</h3>
                  </div>
                  <p className="text-gray-600 text-sm">
                    Organize your opportunities by site, status, and more. Keep track of your progress.
                  </p>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 shadow-sm h-full">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="bg-primary/10 p-2 rounded-md mr-3">
                      <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-8a2 2 0 00-2-2H10a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-800">Track Performance</h3>
                  </div>
                  <p className="text-gray-600 text-sm">
                    Analytics to monitor your outreach success, credit usage, and opportunity engagement.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-primary mb-4">Flexible Pricing for Every Stage</h2>
              <p className="text-gray-600 mb-6">Choose the plan that best fits your backlink strategy and budget. Start with a free trial!</p>
              
              <div className="flex items-center justify-center gap-3 mb-8">
                <span className={`text-sm ${pricingInterval === "monthly" ? "text-primary font-medium" : "text-gray-500"}`}>Monthly</span>
                <Switch 
                  checked={pricingInterval === "annual"}
                  onCheckedChange={(checked) => setPricingInterval(checked ? "annual" : "monthly")}
                />
                <span className={`text-sm ${pricingInterval === "annual" ? "text-primary font-medium" : "text-gray-500"}`}>Annually</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Free Trial */}
              <Card className="border border-gray-200 overflow-hidden">
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold mb-2">Free Trial</h3>
                  <p className="text-gray-500 text-sm mb-4">Try LinkDripAI for 7 days with core features.</p>
                  <div className="mb-4">
                    <span className="text-3xl font-bold">Free</span>
                  </div>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">7 days free</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">5 opportunities/day</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">10 credits total</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">1 website</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Limited AI email generation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Limited smart recommendations</span>
                    </li>
                  </ul>
                  <Link href="/auth?tab=register&plan=Free+Trial">
                    <Button className="w-full">Start Free Trial</Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Starter Plan */}
              <Card className="border border-gray-200 overflow-hidden">
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold mb-2">Starter</h3>
                  <p className="text-gray-500 text-sm mb-4">Perfect for individuals starting their link building journey.</p>
                  <div className="mb-4">
                    <span className="text-3xl font-bold">${pricingInterval === "monthly" ? "39" : "31"}</span>
                    <span className="text-gray-500 text-sm">/month</span>
                    {pricingInterval === "annual" && <div className="text-xs text-primary mt-1">Billed annually (${31*12}/year)</div>}
                  </div>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">10 opportunities/day</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">50 credits/month</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">1 website</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Smart recommendations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Unlimited AI email</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">All features included</span>
                    </li>
                  </ul>
                  <Link href="/auth?tab=register&plan=Starter">
                    <Button className="w-full">Get Started</Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Grow Plan */}
              <Card className="border border-gray-200 overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 bg-primary text-white text-center text-xs py-1 font-medium">
                  MOST POPULAR
                </div>
                <CardContent className="p-6 pt-8">
                  <h3 className="text-xl font-semibold mb-2">Grow</h3>
                  <p className="text-gray-500 text-sm mb-4">For growing businesses looking to scale their outreach.</p>
                  <div className="mb-4">
                    <span className="text-3xl font-bold">${pricingInterval === "monthly" ? "69" : "55"}</span>
                    <span className="text-gray-500 text-sm">/month</span>
                    {pricingInterval === "annual" && <div className="text-xs text-primary mt-1">Billed annually (${55*12}/year)</div>}
                  </div>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">20 opportunities/day</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">150 credits/month</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Up to 2 websites</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Smart recommendations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Unlimited AI email</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">All features included</span>
                    </li>
                  </ul>
                  <Link href="/auth?tab=register&plan=Grow">
                    <Button className="w-full">Get Started</Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Pro Plan */}
              <Card className="border border-gray-200 overflow-hidden">
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold mb-2">Pro</h3>
                  <p className="text-gray-500 text-sm mb-4">For agencies and serious link builders managing multiple clients.</p>
                  <div className="mb-4">
                    <span className="text-3xl font-bold">${pricingInterval === "monthly" ? "129" : "103"}</span>
                    <span className="text-gray-500 text-sm">/month</span>
                    {pricingInterval === "annual" && <div className="text-xs text-primary mt-1">Billed annually (${103*12}/year)</div>}
                  </div>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">30 opportunities/day</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">300 credits/month</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Up to 5 websites</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Smart recommendations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Unlimited AI email</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">Priority support</span>
                    </li>
                  </ul>
                  <Link href="/auth?tab=register&plan=Pro">
                    <Button className="w-full">Get Started</Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <Link href="/">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-primary mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 9L12 5M12 5L16 9M12 5V15M8 19H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-xl font-bold text-primary">LinkDripAI</span>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/privacy">
                <span className="text-sm text-gray-600 hover:text-primary transition-colors">Privacy</span>
              </Link>
              <Link href="/terms">
                <span className="text-sm text-gray-600 hover:text-primary transition-colors">Terms</span>
              </Link>
              <Link href="/contact">
                <span className="text-sm text-gray-600 hover:text-primary transition-colors">Contact</span>
              </Link>
            </div>
          </div>
          <div className="text-center mt-6">
            <p className="text-sm text-gray-500">© {new Date().getFullYear()} LinkDripAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}