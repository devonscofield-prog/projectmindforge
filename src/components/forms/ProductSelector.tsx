import { useState } from 'react';
import { Plus, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useProducts } from '@/hooks/useProducts';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/formatters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ProductEntry {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  promotionNotes?: string;
}

interface ProductSelectorProps {
  value: ProductEntry[];
  onChange: (products: ProductEntry[]) => void;
}

export function ProductSelector({ value, onChange }: ProductSelectorProps) {
  const { data: products, isLoading } = useProducts();
  const [selectedProductId, setSelectedProductId] = useState('');

  const addProduct = () => {
    if (!selectedProductId || !products) return;

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    // Check if product already added
    if (value.some(p => p.productId === selectedProductId)) return;

    const newEntry: ProductEntry = {
      productId: product.id,
      productName: product.name,
      unitPrice: 0,
      quantity: 1,
      promotionNotes: '',
    };

    onChange([...value, newEntry]);
    setSelectedProductId('');
  };

  const removeProduct = (productId: string) => {
    onChange(value.filter(p => p.productId !== productId));
  };

  const updateProduct = (productId: string, updates: Partial<ProductEntry>) => {
    onChange(
      value.map(p =>
        p.productId === productId ? { ...p, ...updates } : p
      )
    );
  };

  const totalRevenue = value.reduce(
    (sum, p) => sum + p.unitPrice * p.quantity,
    0
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const availableProducts = products?.filter(
    p => !value.some(v => v.productId === p.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select value={selectedProductId} onValueChange={setSelectedProductId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select a product..." />
          </SelectTrigger>
          <SelectContent>
            {availableProducts?.map(product => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          onClick={addProduct}
          disabled={!selectedProductId}
          variant="outline"
          size="default"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6 border-2 border-dashed rounded-lg">
          No products added yet. Select a product above to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {value.map((entry) => (
            <Card key={entry.productId}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">{entry.productName}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProduct(entry.productId)}
                        aria-label={`Remove ${entry.productName}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`price-${entry.productId}`}>Price Per Unit *</Label>
                      <Input
                        id={`price-${entry.productId}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={entry.unitPrice || ''}
                        onChange={(e) =>
                          updateProduct(entry.productId, {
                            unitPrice: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`quantity-${entry.productId}`}>Quantity *</Label>
                      <Input
                        id={`quantity-${entry.productId}`}
                        type="number"
                        min="1"
                        value={entry.quantity}
                        onChange={(e) =>
                          updateProduct(entry.productId, {
                            quantity: parseInt(e.target.value) || 1,
                          })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`promo-${entry.productId}`}>Promotion Details (Optional)</Label>
                    <Textarea
                      id={`promo-${entry.productId}`}
                      value={entry.promotionNotes || ''}
                      onChange={(e) =>
                        updateProduct(entry.productId, {
                          promotionNotes: e.target.value,
                        })
                      }
                      placeholder="e.g., 20% discount for annual commitment, free training..."
                      rows={2}
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Subtotal: {formatCurrency(entry.unitPrice * entry.quantity)}
                    </span>
                    {entry.unitPrice === 0 && (
                      <span className="flex items-center gap-1 text-amber-500">
                        <AlertCircle className="h-3 w-3" />
                        <span className="text-xs">$0 price</span>
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-between items-center pt-2 border-t">
            <span className="font-semibold">Total Revenue:</span>
            <span className="text-xl font-bold text-primary">
              {formatCurrency(totalRevenue)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
