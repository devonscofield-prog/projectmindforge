import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { getProspectProductsSummary, ProspectProductSummary } from '@/api/callProducts';
import { Package, DollarSign, Hash, Calendar, ChevronDown, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { getCallDetailUrl } from '@/lib/routes';
import { createLogger } from '@/lib/logger';

const log = createLogger('ProspectProductsBreakdown');

interface ProspectProductsBreakdownProps {
  prospectId: string;
}

export function ProspectProductsBreakdown({ prospectId }: ProspectProductsBreakdownProps) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProspectProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadProducts() {
      try {
        const data = await getProspectProductsSummary(prospectId);
        setProducts(data);
      } catch (error) {
        log.error('Error loading products', { error, prospectId });
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, [prospectId]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const toggleProduct = (productId: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  if (loading) {
    return null;
  }

  if (products.length === 0) {
    return null;
  }

  const totalRevenue = products.reduce((sum, p) => sum + p.total_revenue, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Products Breakdown
        </CardTitle>
        <CardDescription>
          All products discussed across {products.reduce((sum, p) => sum + p.call_count, 0)} calls
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                <span>Total Revenue</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Package className="h-4 w-4" />
                <span>Unique Products</span>
              </div>
              <p className="text-2xl font-bold">{products.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span>Top Product</span>
              </div>
              <p className="text-lg font-semibold truncate">{products[0]?.product_name}</p>
            </div>
          </div>

          {/* Products Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                  <TableHead className="text-center">Calls</TableHead>
                  <TableHead className="text-right">Avg Price</TableHead>
                  <TableHead className="text-right">Last Discussed</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const isExpanded = expandedProducts.has(product.product_id);
                  return (
                    <Collapsible
                      key={product.product_id}
                      open={isExpanded}
                      onOpenChange={() => toggleProduct(product.product_id)}
                      asChild
                    >
                      <>
                        <TableRow className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              {product.product_name}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(product.total_revenue)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{product.call_count}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(product.avg_unit_price)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {format(new Date(product.most_recent_call_date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/20 p-0">
                              <div className="p-4 space-y-3">
                                <h4 className="text-sm font-semibold">Call History</h4>
                                <div className="space-y-2">
                                  {product.calls.map((call) => (
                                    <div
                                      key={call.call_id}
                                      className="flex items-center justify-between bg-background rounded-md p-3 border hover:border-primary/50 transition-colors cursor-pointer"
                                      onClick={() => navigate(getCallDetailUrl(call.call_id))}
                                    >
                                      <div className="flex items-center gap-4 flex-1">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                          <Calendar className="h-4 w-4" />
                                          {format(new Date(call.call_date), 'MMM d, yyyy')}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                                          <span>{formatCurrency(call.unit_price)} × {call.quantity}</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        {call.promotion_notes && (
                                          <Badge variant="outline" className="text-xs">
                                            Promotion
                                          </Badge>
                                        )}
                                        <span className="font-mono text-sm font-semibold">
                                          {formatCurrency(call.unit_price * call.quantity)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
