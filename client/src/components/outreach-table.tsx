import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { OutreachEmail } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { 
  Clock, 
  CheckCircle2, 
  X, 
  AlertTriangle, 
  Send,
  MailCheck, 
  Mail, 
  Repeat 
} from "lucide-react";

interface OutreachTableProps {
  emails: OutreachEmail[];
  onViewEmail: (email: OutreachEmail) => void;
}

export default function OutreachTable({ emails, onViewEmail }: OutreachTableProps) {
  const { toast } = useToast();
  
  const followUpMutation = useMutation({
    mutationFn: async (emailId: number) => {
      const res = await apiRequest("POST", `/api/email/${emailId}/follow-up`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emails"] });
      toast({
        title: "Follow-up email sent",
        description: "Your follow-up email has been sent successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send follow-up",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleFollowUp = (emailId: number) => {
    followUpMutation.mutate(emailId);
  };
  
  const getStatusInfo = (status: string | null) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'sent':
        return {
          class: 'bg-blue-100 text-blue-800',
          icon: <Send className="h-4 w-4 mr-1.5" />,
          label: 'Sent'
        };
      case 'responded':
        return {
          class: 'bg-green-100 text-green-800',
          icon: <CheckCircle2 className="h-4 w-4 mr-1.5" />,
          label: 'Replied'
        };
      case 'awaiting response':
        return {
          class: 'bg-yellow-100 text-yellow-800',
          icon: <Clock className="h-4 w-4 mr-1.5" />,
          label: 'Awaiting'
        };
      case 'no response':
        return {
          class: 'bg-red-100 text-red-800',
          icon: <AlertTriangle className="h-4 w-4 mr-1.5" />,
          label: 'No Response'
        };
      case 'completed':
        return {
          class: 'bg-green-100 text-green-800',
          icon: <MailCheck className="h-4 w-4 mr-1.5" />,
          label: 'Completed'
        };
      case 'failed':
        return {
          class: 'bg-red-100 text-red-800',
          icon: <X className="h-4 w-4 mr-1.5" />,
          label: 'Failed'
        };
      default:
        return {
          class: 'bg-gray-100 text-gray-800',
          icon: <Mail className="h-4 w-4 mr-1.5" />,
          label: status || 'Unknown'
        };
    }
  };
  
  return (
    <div className="bg-white shadow overflow-hidden border border-gray-200 sm:rounded-lg">
      <Table>
        <TableHeader className="bg-gray-50">
          <TableRow>
            <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Site</TableHead>
            <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</TableHead>
            <TableHead className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</TableHead>
            <TableHead className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</TableHead>
            <TableHead className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-white divide-y divide-gray-200">
          {emails.map((email) => (
            <TableRow key={email.id}>
              <TableCell className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium">
                    {email.siteName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{email.siteName}</div>
                    <div className="text-xs text-gray-500">DA: {email.domainAuthority}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{email.contactEmail}</div>
                <div className="text-xs text-gray-500">{email.contactRole || 'Contact'}</div>
              </TableCell>
              <TableCell className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {email.sentAt ? formatDistanceToNow(new Date(email.sentAt), { addSuffix: true }) : 'Not sent yet'}
              </TableCell>
              <TableCell className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                <Badge className={`flex items-center ${getStatusInfo(email.status || '').class}`}>
                  {getStatusInfo(email.status).icon}
                  {getStatusInfo(email.status).label}
                </Badge>
              </TableCell>
              <TableCell className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                {email.status === 'Awaiting response' || email.status === 'No response' ? (
                  <Button
                    variant="link"
                    onClick={() => handleFollowUp(email.id)}
                    disabled={followUpMutation.isPending}
                    className="text-primary"
                  >
                    Follow up
                  </Button>
                ) : (
                  <Button
                    variant="link"
                    onClick={() => onViewEmail(email)}
                    className="text-primary"
                  >
                    View
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          
          {emails.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                No outreach emails found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
