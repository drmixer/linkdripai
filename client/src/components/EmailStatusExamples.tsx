import React from 'react';
import { EmailStatusIndicator, type EmailStatus } from './EmailStatusIndicator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * A component that shows examples of all email status indicators
 * This is for demonstration purposes to showcase how the indicators look
 */
export function EmailStatusExamples() {
  const statuses: EmailStatus[] = [
    'draft',
    'queued',
    'sending',
    'sent',
    'delivered',
    'opened',
    'clicked',
    'replied',
    'bounced',
    'failed',
    'spam',
    'unsent',
    'unknown'
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Status Indicators</CardTitle>
        <CardDescription>Visual indicators for tracking email statuses</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Example with just icons */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Icon Only</h3>
            <div className="flex flex-wrap gap-2">
              {statuses.map(status => (
                <EmailStatusIndicator key={status} status={status} />
              ))}
            </div>
          </div>
          
          {/* Example with text */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Icon with Text</h3>
            <div className="flex flex-wrap gap-2">
              {statuses.map(status => (
                <EmailStatusIndicator key={status} status={status} showText />
              ))}
            </div>
          </div>
        </div>
        
        <div className="pt-4">
          <h3 className="text-sm font-medium mb-2">Small Variant (For Tables/Lists)</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-4">Recipient</th>
                <th className="text-left py-2 px-4">Subject</th>
                <th className="text-left py-2 px-4">Status</th>
                <th className="text-left py-2 px-4">Sent Date</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 px-4">contact@example.com</td>
                <td className="py-2 px-4">LinkDripAI Opportunity #123</td>
                <td className="py-2 px-4">
                  <EmailStatusIndicator status="sent" small />
                </td>
                <td className="py-2 px-4">2 hours ago</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4">john@example.org</td>
                <td className="py-2 px-4">Check out this backlink opportunity</td>
                <td className="py-2 px-4">
                  <EmailStatusIndicator status="opened" small />
                </td>
                <td className="py-2 px-4">Yesterday</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4">info@example.net</td>
                <td className="py-2 px-4">Backlink partnership proposal</td>
                <td className="py-2 px-4">
                  <EmailStatusIndicator status="replied" small />
                </td>
                <td className="py-2 px-4">May 10, 2025</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4">admin@example.co</td>
                <td className="py-2 px-4">LinkDripAI Backlink Request</td>
                <td className="py-2 px-4">
                  <EmailStatusIndicator status="bounced" small />
                </td>
                <td className="py-2 px-4">May 9, 2025</td>
              </tr>
              <tr>
                <td className="py-2 px-4">support@example.io</td>
                <td className="py-2 px-4">Guest post opportunity</td>
                <td className="py-2 px-4">
                  <EmailStatusIndicator status="queued" small />
                </td>
                <td className="py-2 px-4">Just now</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}