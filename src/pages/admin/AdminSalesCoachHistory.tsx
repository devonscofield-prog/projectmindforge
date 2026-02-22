import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useAdminCoachSessions, useUsersWithCoachSessions } from '@/hooks/useAdminCoachSessions';
import { CoachSessionStatsCard } from '@/components/admin/CoachSessionStatsCard';
import { lazy, Suspense } from 'react';
const CoachSessionViewerSheet = lazy(() => import('@/components/admin/CoachSessionViewerSheet').then(m => ({ default: m.CoachSessionViewerSheet })));
import type { AdminCoachSession } from '@/api/adminSalesCoachSessions';
import { Skeleton } from '@/components/ui/skeleton';

const PAGE_SIZE = 20;

export default function AdminSalesCoachHistory() {
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedSession, setSelectedSession] = useState<AdminCoachSession | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: usersData } = useUsersWithCoachSessions();
  const { data, isLoading } = useAdminCoachSessions({
    userId: selectedUserId === 'all' ? undefined : selectedUserId,
    searchQuery: debouncedSearch || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const sessions = data?.sessions || [];
  const totalCount = data?.total || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleSearch = () => {
    setDebouncedSearch(searchQuery);
    setPage(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const openSession = (session: AdminCoachSession) => {
    setSelectedSession(session);
    setSheetOpen(true);
  };

  const getPreviewText = (session: AdminCoachSession) => {
    const lastUserMessage = [...session.messages]
      .reverse()
      .find(m => m.role === 'user');
    if (!lastUserMessage) return 'No messages';
    const text = lastUserMessage.content;
    return text.length > 80 ? text.slice(0, 80) + '...' : text;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Sales Coach History</h1>
          <p className="text-muted-foreground">
            View all Sales Coach conversations across your team
          </p>
        </div>

        <CoachSessionStatsCard />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversation History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Select value={selectedUserId} onValueChange={v => { setSelectedUserId(v); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {usersData?.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex flex-1 gap-2">
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                />
                <Button onClick={handleSearch} variant="secondary">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No conversations found</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead className="hidden md:table-cell">Last Message</TableHead>
                        <TableHead className="text-center">Messages</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map(session => (
                        <TableRow
                          key={session.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openSession(session)}
                        >
                          <TableCell className="font-medium">
                            {session.user_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {session.account_name || session.prospect_name || '—'}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground max-w-[300px] truncate">
                            {getPreviewText(session)}
                          </TableCell>
                          <TableCell className="text-center">
                            {session.messages.length}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(session.updated_at), 'MMM d, h:mm a')}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={session.is_active ? 'default' : 'secondary'} className="text-xs">
                              {session.is_active ? 'Active' : 'Archived'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={page >= totalPages - 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {sheetOpen && (
        <Suspense fallback={null}>
          <CoachSessionViewerSheet
            session={selectedSession}
            open={sheetOpen}
            onOpenChange={setSheetOpen}
          />
        </Suspense>
      )}
    </AppLayout>
  );
}
