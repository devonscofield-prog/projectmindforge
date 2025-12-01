import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCallProducts, CallProduct } from '@/api/callProducts';
import { Package, DollarSign, Hash, Tag } from 'lucide-react';
import { createLogger } from '@/lib/logger';

const log = createLogger('CallProductsSummary');

interface CallProductsSummaryProps {
  callId: string;
}

interface ProductWithDetails extends CallProduct {
  products?: {
    id: string;
    name: string;
    slug: string;
  };
}

export function CallProductsSummary({ callId }: CallProductsSummaryProps) {
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      try {
        const data = await getCallProducts(callId);
        setProducts(data as ProductWithDetails[]);
      } catch (error) {
        log.error('Error loading products', { error, callId });
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, [callId]);

  if (loading) {
    return null;
  }

  if (products.length === 0) {
    return null;
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const totalRevenue = products.reduce((sum, p) => sum + (p.unit_price * p.quantity), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Products Discussed
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="border rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-base">
                    {product.products?.name || 'Unknown Product'}
                  </h4>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      <span>{formatCurrency(product.unit_price)} per unit</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Hash className="h-4 w-4" />
                      <span>Qty: {product.quantity}</span>
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="font-mono">
                  {formatCurrency(product.unit_price * product.quantity)}
                </Badge>
              </div>

              {product.promotion_notes && (
                <div className="bg-muted/50 rounded-md p-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <span>Promotion Details</span>
                  </div>
                  <p className="text-sm text-muted-foreground pl-6">
                    {product.promotion_notes}
                  </p>
                </div>
              )}
            </div>
          ))}

          {products.length > 1 && (
            <div className="border-t pt-4 flex items-center justify-between">
              <span className="font-semibold">Total Revenue</span>
              <span className="text-xl font-bold">{formatCurrency(totalRevenue)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
