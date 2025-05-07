import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertUserSchema } from "@shared/schema";
import { Link } from "wouter";
import { Loader2, Link as LinkIcon } from "lucide-react";

// Helper function to parse URL search parameters
function useSearchParams() {
  const isBrowser = typeof window !== "undefined";
  if (!isBrowser) return {};

  const searchParams = new URLSearchParams(window.location.search);
  const params: Record<string, string> = {};
  
  // Get specific params we need
  params.tab = searchParams.get("tab") || "";
  params.plan = searchParams.get("plan") || "";
  
  return params;
}

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.tab === "register" ? "register" : "login";
  const selectedPlan = searchParams.plan || "Free Trial";
  
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const { user, loginMutation, registerMutation } = useAuth();
  const [_, navigate] = useLocation();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (user) {
      // For existing users, go straight to dashboard
      // For new users who just registered, go to onboarding
      if (loginMutation.data) {
        navigate("/dashboard");
      } else if (registerMutation.data) {
        navigate("/onboarding");
      } else {
        navigate("/dashboard");
      }
    }
  }, [user, navigate, loginMutation.data, registerMutation.data]);

  async function onLoginSubmit(data: LoginFormValues) {
    setIsLoading(true);
    try {
      await loginMutation.mutateAsync(data);
    } finally {
      setIsLoading(false);
    }
  }

  async function onRegisterSubmit(data: RegisterFormValues) {
    setIsLoading(true);
    try {
      // Store the selected plan in localStorage for the onboarding page
      const planToStore = selectedPlan === "Free Trial" || 
                          selectedPlan === "Starter" || 
                          selectedPlan === "Grow" || 
                          selectedPlan === "Pro" 
                        ? selectedPlan : "Free Trial";
      localStorage.setItem('selectedPlan', planToStore);
      
      const { confirmPassword, ...registerData } = data;
      await registerMutation.mutateAsync(registerData);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Auth forms */}
      <div className="flex flex-col justify-center w-full max-w-md p-8 bg-white">
        <Link to="/" className="flex items-center mb-8 cursor-pointer hover:opacity-90 transition-opacity">
          <div className="rounded-md bg-primary p-1.5 mr-2">
            <LinkIcon className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">LinkSyncOS</span>
        </Link>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Welcome Back</CardTitle>
                <CardDescription>
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Your username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Your password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isLoading || loginMutation.isPending}
                    >
                      {(isLoading || loginMutation.isPending) ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Sign In
                    </Button>
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="justify-center">
                <p className="text-sm text-center text-gray-500">
                  Don't have an account?{" "}
                  <button 
                    className="text-primary hover:underline" 
                    onClick={() => setActiveTab("register")}
                  >
                    Register here
                  </button>
                </p>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Create Account</CardTitle>
                <CardDescription>
                  {selectedPlan !== "Free Trial" 
                    ? `Register to start your ${selectedPlan} plan`
                    : `Register to start your 7-day Free Trial`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={registerForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input placeholder="First name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Last name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Create a username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="Your email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Create a password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Confirm your password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isLoading || registerMutation.isPending}
                    >
                      {(isLoading || registerMutation.isPending) ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Create Account
                    </Button>
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="justify-center">
                <p className="text-sm text-center text-gray-500">
                  Already have an account?{" "}
                  <button 
                    className="text-primary hover:underline" 
                    onClick={() => setActiveTab("login")}
                  >
                    Sign in here
                  </button>
                </p>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Right side - Hero section */}
      <div className="hidden lg:flex lg:flex-col lg:justify-center lg:w-2/3 bg-gradient-to-br from-primary-100 to-primary-50 p-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Discover High-Quality Backlink Opportunities
          </h1>
          <p className="text-xl text-gray-700 mb-8">
            LinkSyncOS helps you discover, manage, and reach out to backlink prospects that are tailored to your niche.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center mb-3">
                <div className="flex-shrink-0 bg-blue-100 rounded-md p-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="ml-3 text-lg font-medium text-gray-900">Daily Drip Feed</h3>
              </div>
              <p className="text-gray-600">Receive a steady flow of relevant link prospects daily, curated to your content and niche.</p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center mb-3">
                <div className="flex-shrink-0 bg-purple-100 rounded-md p-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="ml-3 text-lg font-medium text-gray-900">AI Email Generator</h3>
              </div>
              <p className="text-gray-600">Smart, AI-powered email generator to craft personalized outreach messages that convert.</p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center mb-3">
                <div className="flex-shrink-0 bg-green-100 rounded-md p-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="ml-3 text-lg font-medium text-gray-900">Track Performance</h3>
              </div>
              <p className="text-gray-600">Monitor your outreach campaigns and track successful backlink acquisitions.</p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center mb-3">
                <div className="flex-shrink-0 bg-yellow-100 rounded-md p-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <h3 className="ml-3 text-lg font-medium text-gray-900">Quality Scoring</h3>
              </div>
              <p className="text-gray-600">Advanced AI scoring system to evaluate and rank backlink opportunities by relevance and value.</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Plans starting at $39/month</h3>
            <p className="text-gray-600 mb-4">Choose the right plan for your link building needs with flexible options to scale.</p>
            <div className="flex space-x-2">
              <div className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm font-medium">Free Trial</div>
              <div className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm font-medium">Starter</div>
              <div className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm font-medium">Grow</div>
              <div className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm font-medium">Pro</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
