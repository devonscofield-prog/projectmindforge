import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { 
  Database, 
  RefreshCw, 
  Trash2, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  FileText,
  Layers,
  BookOpen
} from 'lucide-react';
import { toast } from 'sonner';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';

import {
  getProductKnowledgeStats,
  listProductKnowledgePages,
  triggerProductKnowledgeScrape,
  triggerProductKnowledgeProcessing,
  deleteProductKnowledgePage,
  type ProductKnowledgeStats,
  type ProductKnowledgePage,
} from '@/api/productKnowledge';

const PAGE_SIZE = 20;

function StatsCard({ stats, isLoading }: { stats: ProductKnowledgeStats | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No knowledge base data yet. Click "Scrape Website" to get started.
        </CardContent>
      </Card>
    );
  }

  const statItems = [
    { 
      label: 'Total Pages', 
      value: stats.total_pages, 
      icon: FileText,
      description: `${stats.completed_pages} scraped, ${stats.pending_pages} pending`
    },
    { 
      label: 'Knowledge Chunks', 
      value: stats.total_chunks, 
      icon: Layers,
      description: `${stats.chunks_with_embeddings} with embeddings`
    },
    { 
      label: 'Topics Covered', 
      value: stats.unique_topics?.length || 0, 
      icon: BookOpen,
      description: stats.unique_topics?.slice(0, 3).join(', ') || 'None yet'
    },
    { 
      label: 'Products Found', 
      value: stats.unique_products?.length || 0, 
      icon: Database,
      description: stats.unique_products?.slice(0, 3).join(', ') || 'None yet'
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {statItems.map((item) => (
        <Card key={item.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.label}
            </CardTitle>
            <item.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.value}</div>
            <p className="text-xs text-muted-foreground truncate" title={item.description}>
              {item.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="h-3 w-3 mr-1" /> Completed</Badge>;
    case 'pending':
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    case 'error':
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Error</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function AdminKnowledgeBase() {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['product-knowledge-stats'],
    queryFn: getProductKnowledgeStats,
  });

  const { data: pagesData, isLoading: pagesLoading } = useQuery({
    queryKey: ['product-knowledge-pages', currentPage],
    queryFn: () => listProductKnowledgePages(PAGE_SIZE, (currentPage - 1) * PAGE_SIZE),
  });

  const scrapeMutation = useMutation({
    mutationFn: (fullRescrape: boolean) => triggerProductKnowledgeScrape({ fullRescrape }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Scraped ${result.results?.scraped || 0} pages`);
        queryClient.invalidateQueries({ queryKey: ['product-knowledge-stats'] });
        queryClient.invalidateQueries({ queryKey: ['product-knowledge-pages'] });
      } else {
        toast.error(result.error || 'Scrape failed');
      }
    },
    onError: (error) => {
      toast.error(`Scrape failed: ${error.message}`);
    },
  });

  const processMutation = useMutation({
    mutationFn: () => triggerProductKnowledgeProcessing({ processAll: true }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Processing started');
        queryClient.invalidateQueries({ queryKey: ['product-knowledge-stats'] });
      } else {
        toast.error(result.error || 'Processing failed');
      }
    },
    onError: (error) => {
      toast.error(`Processing failed: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProductKnowledgePage,
    onSuccess: () => {
      toast.success('Page deleted');
      queryClient.invalidateQueries({ queryKey: ['product-knowledge-stats'] });
      queryClient.invalidateQueries({ queryKey: ['product-knowledge-pages'] });
    },
    onError: () => {
      toast.error('Failed to delete page');
    },
  });

  const totalPages = Math.ceil((pagesData?.total || 0) / PAGE_SIZE);

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Product Knowledge Base</h1>
            <p className="text-muted-foreground">
              Manage the StormWind product knowledge used by AI coaching and analysis.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => processMutation.mutate()}
              disabled={processMutation.isPending}
            >
              {processMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Layers className="h-4 w-4 mr-2" />
              )}
              Process Chunks
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={scrapeMutation.isPending}>
                  {scrapeMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Scrape Website
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Scrape StormWind Website</AlertDialogTitle>
                  <AlertDialogDescription>
                    Choose how to scrape the website for product knowledge.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => scrapeMutation.mutate(false)}>
                    Scrape New Only
                  </AlertDialogAction>
                  <AlertDialogAction 
                    onClick={() => scrapeMutation.mutate(true)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Full Re-scrape
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {stats?.last_scraped_at && (
          <p className="text-sm text-muted-foreground">
            Last scraped: {format(new Date(stats.last_scraped_at), 'PPp')}
          </p>
        )}

        <StatsCard stats={stats ?? null} isLoading={statsLoading} />

        <Card>
          <CardHeader>
            <CardTitle>Scraped Pages</CardTitle>
            <CardDescription>
              All pages scraped from the StormWind website
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pagesLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !pagesData?.pages.length ? (
              <div className="py-8 text-center text-muted-foreground">
                No pages scraped yet. Click "Scrape Website" to get started.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scraped At</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagesData.pages.map((page: ProductKnowledgePage) => (
                      <TableRow key={page.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate max-w-[300px]" title={page.title || page.source_url}>
                              {page.title || 'Untitled'}
                            </span>
                            <a 
                              href={page.source_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          {page.scrape_error && (
                            <p className="text-xs text-destructive mt-1">{page.scrape_error}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{page.page_type || 'unknown'}</Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={page.scrape_status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(page.scraped_at), 'PP')}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this page?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove the page and all its chunks from the knowledge base.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => deleteMutation.mutate(page.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="mt-4">
                    <PaginationControls
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={pagesData?.total || 0}
                      pageSize={PAGE_SIZE}
                      onPageChange={setCurrentPage}
                      showPageSize={false}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
