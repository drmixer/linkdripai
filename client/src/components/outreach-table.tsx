import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { 
  Check, 
  Clock, 
  Eye, 
  Mail, 
  MessageSquare, 
  MoreHorizontal, 
  RefreshCcw, 
  Send, 
  Trash,
  AlertCircle
} from 'lucide-react';
import { format, formatDistance } from 'date-fns';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle 
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { OutreachEmail } from '@shared/schema';

interface EmailStatus {
  icon: React.ReactNode;
  color: string;
  label: string;
  description: string;
}

// Mapping of email status to visual indicators
const emailStatusMap: Record<string, EmailStatus> = {
  'Draft': {
    icon: <Clock className="h-4 w-4" />,
    color: 'bg-gray-200 hover:bg-gray-300 text-gray-700',
    label: 'Draft',
    description: 'Email is saved as a draft and not yet sent'
  },
  'Sending': {
    icon: <Send className="h-4 w-4 animate-pulse" />,
    color: 'bg-blue-100 hover:bg-blue-200 text-blue-700',
    label: 'Sending',
    description: 'Email is currently being sent'
  },
  'Sent': {
    icon: <Check className="h-4 w-4" />,
    color: 'bg-green-100 hover:bg-green-200 text-green-700',
    label: 'Sent',
    description: 'Email has been sent successfully'
  },
  'Awaiting response': {
    icon: <Mail className="h-4 w-4" />,
    color: 'bg-amber-100 hover:bg-amber-200 text-amber-700',
    label: 'Awaiting Response',
    description: 'Waiting for recipient to respond'
  },
  'Responded': {
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700',
    label: 'Responded',
    description: 'Recipient has responded to this email'
  },
  'Follow-up sent': {
    icon: <RefreshCcw className="h-4 w-4" />,
    color: 'bg-purple-100 hover:bg-purple-200 text-purple-700',
    label: 'Follow-up Sent',
    description: 'A follow-up email has been sent'
  },
  'Failed': {
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'bg-red-100 hover:bg-red-200 text-red-700',
    label: 'Failed',
    description: 'Email could not be delivered'
  }
};

// Default to a neutral status if status not found in map
const defaultStatus: EmailStatus = {
  icon: <Mail className="h-4 w-4" />,
  color: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
  label: 'Unknown',
  description: 'Email status is unknown'
};

interface OutreachTableProps {
  emails: OutreachEmail[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function OutreachTable({ emails, isLoading, onRefresh }: OutreachTableProps) {
  const [selectedEmail, setSelectedEmail] = useState<OutreachEmail | null>(null);
  const [showEmailContent, setShowEmailContent] = useState(false);
  const [showReplyContent, setShowReplyContent] = useState(false);
  const { toast } = useToast();

  // Grouped emails by status
  const drafts = emails.filter(email => email.status === 'Draft');
  const sent = emails.filter(email => ['Sent', 'Sending', 'Awaiting response'].includes(email.status || ''));
  const responded = emails.filter(email => email.status === 'Responded');
  const followUps = emails.filter(email => email.status === 'Follow-up sent');
  const failed = emails.filter(email => email.status === 'Failed');

  // Create follow-up mutation
  const followUpMutation = useMutation({
    mutationFn: async (emailId: number) => {
      const res = await apiRequest('POST', `/api/email/${emailId}/follow-up`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Follow-up created',
        description: 'A follow-up email has been created. You can edit and send it from the drafts tab.',
      });
      // Invalidate emails query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/emails'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create follow-up',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Deletion mutation
  const deleteMutation = useMutation({
    mutationFn: async (emailId: number) => {
      const res = await apiRequest('DELETE', `/api/email/${emailId}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Email deleted',
        description: 'The email has been deleted successfully.',
      });
      // Invalidate emails query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/emails'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete email',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleFollowUp = (emailId: number) => {
    followUpMutation.mutate(emailId);
  };

  const handleDelete = (emailId: number) => {
    if (confirm('Are you sure you want to delete this email?')) {
      deleteMutation.mutate(emailId);
    }
  };

  const renderStatusBadge = (status?: string | null) => {
    const statusData = status && emailStatusMap[status] ? emailStatusMap[status] : defaultStatus;
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`${statusData.color} flex items-center gap-1`}>
              {statusData.icon}
              <span>{statusData.label}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{statusData.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const renderTimeInfo = (email: OutreachEmail) => {
    if (email.sentAt) {
      return (
        <div className="text-xs text-muted-foreground">
          {format(new Date(email.sentAt), 'PPp')}
          <div className="mt-1">
            {email.responseAt ? (
              <span>
                Response after {formatDistance(new Date(email.responseAt), new Date(email.sentAt))}
              </span>
            ) : (
              <span>
                {formatDistance(new Date(), new Date(email.sentAt))} ago
              </span>
            )}
          </div>
        </div>
      );
    }
    return <span className="text-xs text-muted-foreground">Not sent yet</span>;
  };

  const renderEmailTable = (emailList: OutreachEmail[]) => {
    if (emailList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Mail className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No emails found</h3>
          <p className="text-sm text-muted-foreground mt-2">
            There are no emails in this category yet.
          </p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Time</TableHead>
            <TableHead className="w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {emailList.map((email) => (
            <TableRow key={email.id}>
              <TableCell>{renderStatusBadge(email.status || undefined)}</TableCell>
              <TableCell className="font-medium">{email.contactEmail}</TableCell>
              <TableCell>{email.subject}</TableCell>
              <TableCell>{email.siteName}</TableCell>
              <TableCell>{renderTimeInfo(email)}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => {
                      setSelectedEmail(email);
                      setShowEmailContent(true);
                    }}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Email
                    </DropdownMenuItem>
                    
                    {email.status === 'Responded' && (
                      <DropdownMenuItem onClick={() => {
                        setSelectedEmail(email);
                        setShowReplyContent(true);
                      }}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        View Reply
                      </DropdownMenuItem>
                    )}
                    
                    {(email.status === 'Sent' || email.status === 'Awaiting response') && (
                      <DropdownMenuItem onClick={() => handleFollowUp(email.id)}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Create Follow-up
                      </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem 
                      className="text-red-600"
                      onClick={() => handleDelete(email.id)}
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Email Outreach</CardTitle>
          <CardDescription>
            Manage and track your outreach emails
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sent" className="w-full">
          <TabsList className="grid grid-cols-5 mb-4">
            <TabsTrigger value="sent">
              Sent
              {sent.length > 0 && (
                <Badge variant="secondary" className="ml-2">{sent.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="responded">
              Responded
              {responded.length > 0 && (
                <Badge variant="secondary" className="ml-2">{responded.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="follow-ups">
              Follow-ups
              {followUps.length > 0 && (
                <Badge variant="secondary" className="ml-2">{followUps.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="drafts">
              Drafts
              {drafts.length > 0 && (
                <Badge variant="secondary" className="ml-2">{drafts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="failed">
              Failed
              {failed.length > 0 && (
                <Badge variant="secondary" className="ml-2">{failed.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="sent">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : renderEmailTable(sent)}
          </TabsContent>
          
          <TabsContent value="responded">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : renderEmailTable(responded)}
          </TabsContent>
          
          <TabsContent value="follow-ups">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : renderEmailTable(followUps)}
          </TabsContent>
          
          <TabsContent value="drafts">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : renderEmailTable(drafts)}
          </TabsContent>
          
          <TabsContent value="failed">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : renderEmailTable(failed)}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between text-sm text-muted-foreground">
        <div>Total emails: {emails.length}</div>
        <div>
          {responded.length} responses ({emails.length > 0 
            ? Math.round((responded.length / emails.length) * 100) 
            : 0}% response rate)
        </div>
      </CardFooter>

      {/* Email Content Dialog */}
      <Dialog open={showEmailContent} onOpenChange={setShowEmailContent}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {selectedEmail?.subject}
            </DialogTitle>
            <DialogDescription>
              <div className="flex justify-between mt-2">
                <div>
                  <strong>To:</strong> {selectedEmail?.contactEmail}
                </div>
                <div>
                  {selectedEmail?.sentAt && (
                    <span>{format(new Date(selectedEmail.sentAt), 'PPp')}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center mt-1 gap-2">
                <span className="text-sm">Status:</span> 
                {renderStatusBadge(selectedEmail?.status)}
                {selectedEmail?.messageId && (
                  <span className="text-xs text-muted-foreground ml-4">
                    Message ID: {selectedEmail.messageId}
                  </span>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="my-6 border rounded-md p-4 bg-white">
            <div dangerouslySetInnerHTML={{ __html: selectedEmail?.body || '' }} />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowEmailContent(false)}
            >
              Close
            </Button>
            {(selectedEmail?.status === 'Sent' || selectedEmail?.status === 'Awaiting response') && (
              <Button 
                variant="default" 
                onClick={() => {
                  handleFollowUp(selectedEmail?.id || 0);
                  setShowEmailContent(false);
                }}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Create Follow-up
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reply Content Dialog */}
      <Dialog open={showReplyContent} onOpenChange={setShowReplyContent}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Re: {selectedEmail?.subject}
            </DialogTitle>
            <DialogDescription>
              <div className="flex justify-between mt-2">
                <div>
                  <strong>From:</strong> {selectedEmail?.contactEmail}
                </div>
                <div>
                  {selectedEmail?.responseAt && (
                    <span>{format(new Date(selectedEmail.responseAt), 'PPp')}</span>
                  )}
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="my-6 border rounded-md p-4 bg-white">
            <div dangerouslySetInnerHTML={{ __html: (selectedEmail?.replyContent || 'No reply content available.') as string }} />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowReplyContent(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}