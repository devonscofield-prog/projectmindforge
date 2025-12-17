import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Swords, 
  Plus, 
  ExternalLink, 
  RefreshCw, 
  Trash2, 
  Target,
  MessageSquareWarning,
  HelpCircle,
  AlertTriangle,
  Trophy,
  Building2,
  DollarSign,
  Package,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
import { ScrollArea } from '@/components/ui/scroll-area';

import { 
  fetchCompetitors, 
  createCompetitor, 
  deleteCompetitor, 
  researchCompetitor 
} from '@/api/competitors';
import type { Competitor } from '@/types/competitors';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { getAdminPageBreadcrumb } from '@/lib/breadcrumbConfig';

export default function AdminCompetitors() {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [newCompetitorName, setNewCompetitorName] = useState('');
  const [newCompetitorWebsite, setNewCompetitorWebsite] = useState('');
  const [researchingIds, setResearchingIds] = useState<Set<string>>(new Set());

  const { data: competitors, isLoading } = useQuery({
    queryKey: ['competitors'],
    queryFn: fetchCompetitors,
  });

  const createMutation = useMutation({
    mutationFn: ({ name, website }: { name: string; website: string }) => 
      createCompetitor(name, website),
    onSuccess: async (competitor) => {
      queryClient.invalidateQueries({ queryKey: ['competitors'] });
      setIsAddDialogOpen(false);
      setNewCompetitorName('');
      setNewCompetitorWebsite('');
      toast.success('Competitor added, starting research...');
      
      // Start research immediately
      handleResearch(competitor);
    },
    onError: (error) => {
      toast.error(`Failed to add competitor: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCompetitor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitors'] });
      toast.success('Competitor deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const handleResearch = async (competitor: Competitor) => {
    setResearchingIds(prev => new Set(prev).add(competitor.id));
    
    try {
      const result = await researchCompetitor(
        competitor.id,
        competitor.website,
        competitor.name
      );
      
      if (result.success) {
        toast.success('Research completed!');
        queryClient.invalidateQueries({ queryKey: ['competitors'] });
      } else {
        toast.error(result.error || 'Research failed');
      }
    } catch (error) {
      toast.error('Research failed');
    } finally {
      setResearchingIds(prev => {
        const next = new Set(prev);
        next.delete(competitor.id);
        return next;
      });
    }
  };

  const handleAddCompetitor = () => {
    if (!newCompetitorName.trim() || !newCompetitorWebsite.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    createMutation.mutate({ 
      name: newCompetitorName.trim(), 
      website: newCompetitorWebsite.trim() 
    });
  };

  const getStatusBadge = (competitor: Competitor) => {
    const isResearching = researchingIds.has(competitor.id);
    
    if (isResearching || competitor.research_status === 'processing') {
      return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Researching</Badge>;
    }
    if (competitor.research_status === 'completed' && competitor.intel) {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Ready</Badge>;
    }
    if (competitor.research_status === 'error') {
      return <Badge variant="destructive">Error</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageBreadcrumb items={getAdminPageBreadcrumb('competitors')} />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Swords className="h-6 w-6 text-primary" />
            Competitor Intelligence
          </h1>
          <p className="text-muted-foreground">
            Research competitors and generate AI-powered battlecards
          </p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Research Competitor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Research New Competitor</DialogTitle>
              <DialogDescription>
                Enter a competitor's website to automatically research and generate a battlecard.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Competitor Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Acme Corp"
                  value={newCompetitorName}
                  onChange={(e) => setNewCompetitorName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website URL</Label>
                <Input
                  id="website"
                  placeholder="e.g., acme.com"
                  value={newCompetitorWebsite}
                  onChange={(e) => setNewCompetitorWebsite(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddCompetitor}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Start Research'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Competitors Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !competitors?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Swords className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No competitors yet</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">
              Research your first competitor to generate AI-powered battlecards with pricing intel, trap questions, and talk tracks.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Research Competitor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {competitors.map((competitor) => (
            <Card 
              key={competitor.id} 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedCompetitor(competitor)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {competitor.logo_url ? (
                      <img 
                        src={competitor.logo_url} 
                        alt={competitor.name}
                        className="h-10 w-10 rounded object-contain bg-muted"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg">{competitor.name}</CardTitle>
                      <a 
                        href={competitor.website.startsWith('http') ? competitor.website : `https://${competitor.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {competitor.website.replace(/^https?:\/\//, '')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  {getStatusBadge(competitor)}
                </div>
              </CardHeader>
              <CardContent>
                {competitor.intel ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {competitor.intel.overview.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="gap-1">
                        <Package className="h-3 w-3" />
                        {competitor.intel.products.length} Products
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Target className="h-3 w-3" />
                        {competitor.intel.weaknesses.length} Weaknesses
                      </Badge>
                    </div>
                    {competitor.last_researched_at && (
                      <p className="text-xs text-muted-foreground">
                        Updated {format(new Date(competitor.last_researched_at), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click to research and generate battlecard
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Battlecard Sheet */}
      <Sheet open={!!selectedCompetitor} onOpenChange={(open) => !open && setSelectedCompetitor(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
          {selectedCompetitor && (
            <>
              <SheetHeader className="flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {selectedCompetitor.logo_url ? (
                      <img 
                        src={selectedCompetitor.logo_url} 
                        alt={selectedCompetitor.name}
                        className="h-12 w-12 rounded object-contain bg-muted"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div>
                      <SheetTitle>{selectedCompetitor.name}</SheetTitle>
                      <SheetDescription>{selectedCompetitor.website}</SheetDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResearch(selectedCompetitor)}
                      disabled={researchingIds.has(selectedCompetitor.id)}
                    >
                      {researchingIds.has(selectedCompetitor.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete competitor?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete {selectedCompetitor.name} and all associated intel.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              deleteMutation.mutate(selectedCompetitor.id);
                              setSelectedCompetitor(null);
                            }}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1 -mx-6 px-6">
                {selectedCompetitor.intel ? (
                  <Tabs defaultValue="battlecard" className="mt-6">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="battlecard">Battlecard</TabsTrigger>
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="products">Products</TabsTrigger>
                      <TabsTrigger value="pricing">Pricing</TabsTrigger>
                    </TabsList>

                    <TabsContent value="battlecard" className="space-y-6 mt-4">
                      {/* Why We Win */}
                      <div>
                        <h3 className="font-semibold flex items-center gap-2 mb-3">
                          <Trophy className="h-4 w-4 text-green-500" />
                          Why We Win
                        </h3>
                        <div className="space-y-3">
                          {selectedCompetitor.intel.battlecard.why_we_win.map((item, i) => (
                            <Card key={i} className="bg-green-500/5 border-green-500/20">
                              <CardContent className="p-3">
                                <p className="font-medium text-sm">{item.point}</p>
                                <p className="text-sm text-muted-foreground mt-1">{item.talk_track}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>

                      {/* Trap Questions */}
                      <div>
                        <h3 className="font-semibold flex items-center gap-2 mb-3">
                          <HelpCircle className="h-4 w-4 text-blue-500" />
                          Trap Questions
                        </h3>
                        <div className="space-y-3">
                          {selectedCompetitor.intel.battlecard.trap_questions.map((item, i) => (
                            <Card key={i} className="bg-blue-500/5 border-blue-500/20">
                              <CardContent className="p-3">
                                <p className="font-medium text-sm">"{item.question}"</p>
                                <p className="text-sm text-muted-foreground mt-1">{item.why_it_works}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>

                      {/* Objection Handlers */}
                      <div>
                        <h3 className="font-semibold flex items-center gap-2 mb-3">
                          <MessageSquareWarning className="h-4 w-4 text-orange-500" />
                          Objection Handlers
                        </h3>
                        <div className="space-y-3">
                          {selectedCompetitor.intel.battlecard.objection_handlers.map((item, i) => (
                            <Card key={i} className="bg-orange-500/5 border-orange-500/20">
                              <CardContent className="p-3">
                                <p className="font-medium text-sm">"{item.objection}"</p>
                                <p className="text-sm text-muted-foreground mt-1">{item.response}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>

                      {/* Landmines */}
                      {selectedCompetitor.intel.battlecard.landmines?.length ? (
                        <div>
                          <h3 className="font-semibold flex items-center gap-2 mb-3">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            Landmines to Avoid
                          </h3>
                          <div className="space-y-3">
                            {selectedCompetitor.intel.battlecard.landmines.map((item, i) => (
                              <Card key={i} className="bg-red-500/5 border-red-500/20">
                                <CardContent className="p-3">
                                  <p className="font-medium text-sm">{item.topic}</p>
                                  <p className="text-sm text-muted-foreground mt-1">{item.warning}</p>
                                  <p className="text-sm text-primary mt-1">Pivot: {item.pivot}</p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </TabsContent>

                    <TabsContent value="overview" className="space-y-4 mt-4">
                      <Card>
                        <CardContent className="p-4 space-y-3">
                          <div>
                            <p className="text-sm text-muted-foreground">Description</p>
                            <p>{selectedCompetitor.intel.overview.description}</p>
                          </div>
                          {selectedCompetitor.intel.overview.tagline && (
                            <div>
                              <p className="text-sm text-muted-foreground">Tagline</p>
                              <p>"{selectedCompetitor.intel.overview.tagline}"</p>
                            </div>
                          )}
                          <div>
                            <p className="text-sm text-muted-foreground">Target Market</p>
                            <p>{selectedCompetitor.intel.overview.target_market}</p>
                          </div>
                          {selectedCompetitor.intel.positioning?.key_differentiators?.length ? (
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Key Differentiators</p>
                              <div className="flex flex-wrap gap-2">
                                {selectedCompetitor.intel.positioning.key_differentiators.map((d, i) => (
                                  <Badge key={i} variant="outline">{d}</Badge>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>

                      {/* Weaknesses */}
                      <div>
                        <h3 className="font-semibold flex items-center gap-2 mb-3">
                          <Target className="h-4 w-4 text-red-500" />
                          Identified Weaknesses
                        </h3>
                        <div className="space-y-2">
                          {selectedCompetitor.intel.weaknesses.map((w, i) => (
                            <Card key={i}>
                              <CardContent className="p-3">
                                <p className="font-medium text-sm">{w.area}</p>
                                <p className="text-sm text-muted-foreground">{w.description}</p>
                                <p className="text-sm text-green-600 mt-1">How to exploit: {w.how_to_exploit}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="products" className="space-y-3 mt-4">
                      {selectedCompetitor.intel.products.map((product, i) => (
                        <Card key={i}>
                          <CardContent className="p-4">
                            <h4 className="font-semibold">{product.name}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
                            {product.key_features?.length ? (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {product.key_features.map((f, j) => (
                                  <Badge key={j} variant="secondary" className="text-xs">{f}</Badge>
                                ))}
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      ))}
                    </TabsContent>

                    <TabsContent value="pricing" className="mt-4">
                      {selectedCompetitor.intel.pricing ? (
                        <div className="space-y-4">
                          {selectedCompetitor.intel.pricing.model && (
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">Model: {selectedCompetitor.intel.pricing.model}</span>
                            </div>
                          )}
                          {selectedCompetitor.intel.pricing.tiers?.map((tier, i) => (
                            <Card key={i}>
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start">
                                  <h4 className="font-semibold">{tier.name}</h4>
                                  <Badge>{tier.price}</Badge>
                                </div>
                                {tier.features?.length ? (
                                  <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                                    {tier.features.map((f, j) => (
                                      <li key={j}>• {f}</li>
                                    ))}
                                  </ul>
                                ) : null}
                              </CardContent>
                            </Card>
                          ))}
                          {selectedCompetitor.intel.pricing.notes && (
                            <p className="text-sm text-muted-foreground">
                              {selectedCompetitor.intel.pricing.notes}
                            </p>
                          )}
                        </div>
                      ) : (
                        <Card className="border-dashed">
                          <CardContent className="flex flex-col items-center justify-center py-8">
                            <DollarSign className="h-8 w-8 text-muted-foreground/50 mb-2" />
                            <p className="text-muted-foreground">No pricing information found</p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Swords className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground mb-4">
                      {researchingIds.has(selectedCompetitor.id) 
                        ? 'Researching competitor...'
                        : 'No intel available yet'}
                    </p>
                    {!researchingIds.has(selectedCompetitor.id) && (
                      <Button onClick={() => handleResearch(selectedCompetitor)}>
                        Start Research
                      </Button>
                    )}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
      </div>
    </AppLayout>
  );
}
