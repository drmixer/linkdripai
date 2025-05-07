import Layout from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("30days");
  
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["/api/analytics", timeRange],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/analytics?timeRange=${timeRange}`);
      return await res.json();
    },
  });
  
  // Colors for charts
  const colors = {
    primary: "#3B82F6",
    success: "#10B981",
    purple: "#8B5CF6",
    yellow: "#F59E0B",
    red: "#EF4444"
  };
  
  const pieColors = [colors.primary, colors.success, colors.purple, colors.yellow];
  
  return (
    <Layout title="Analytics Dashboard">
      <div className="flex justify-end mb-6">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">Last 7 days</SelectItem>
            <SelectItem value="30days">Last 30 days</SelectItem>
            <SelectItem value="90days">Last 90 days</SelectItem>
            <SelectItem value="year">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Email Outreach Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse flex flex-col">
                <div className="h-64 bg-slate-200 rounded"></div>
              </div>
            ) : analyticsData?.emailPerformance ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={analyticsData.emailPerformance}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="sent" stroke={colors.primary} activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="responses" stroke={colors.success} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <p className="text-gray-500">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Backlinks Acquired</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse flex flex-col">
                <div className="h-64 bg-slate-200 rounded"></div>
              </div>
            ) : analyticsData?.backlinksAcquired ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={analyticsData.backlinksAcquired}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill={colors.primary} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <p className="text-gray-500">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Response Rate by Niche</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse flex flex-col">
                <div className="h-64 bg-slate-200 rounded"></div>
              </div>
            ) : analyticsData?.responseRateByNiche ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analyticsData.responseRateByNiche}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill={colors.primary}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {analyticsData.responseRateByNiche.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <p className="text-gray-500">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Credit Usage</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse flex flex-col">
                <div className="h-64 bg-slate-200 rounded"></div>
              </div>
            ) : analyticsData?.creditUsage ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={analyticsData.creditUsage}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="used" fill={colors.primary} />
                  <Bar dataKey="remaining" fill={colors.success} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <p className="text-gray-500">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Domain Authority Distribution of Acquired Backlinks</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse flex flex-col">
                <div className="h-64 bg-slate-200 rounded"></div>
              </div>
            ) : analyticsData?.daDistribution ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={analyticsData.daDistribution}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill={colors.purple} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <p className="text-gray-500">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
