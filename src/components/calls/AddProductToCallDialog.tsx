import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProducts, Product } from '@/hooks/useProducts';
import { Loader2 } from 'lucide-react';

interface AddProductToCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProductIds: string[];
  onAdd: (productId: string, unitPrice: number, quantity: number, promotionNotes: string) => Promise<void>;
}

export function AddProductToCallDialog({ open, onOpenChange, existingProductIds, onAdd }: AddProductToCallDialogProps) {
  const { data: products, isLoading: productsLoading } = useProducts();
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [promotionNotes, setPromotionNotes] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const availableProducts = (products || []).filter((p: Product) => !existingProductIds.includes(p.id));

  const handleAdd = async () => {
    if (!selectedProductId) return;

    const price = parseFloat(unitPrice);
    const qty = parseInt(quantity);

    if (isNaN(price) || price < 0) {
      return;
    }
    if (isNaN(qty) || qty < 1) {
      return;
    }

    setIsAdding(true);
    try {
      await onAdd(selectedProductId, price, qty, promotionNotes.trim() || '');
      // Reset form
      setSelectedProductId('');
      setUnitPrice('');
      setQuantity('1');
      setPromotionNotes('');
      onOpenChange(false);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Product to Call</DialogTitle>
          <DialogDescription>
            Add another product that was discussed in this call
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="product">Product</Label>
            {productsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading products...
              </div>
            ) : availableProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">All products have been added to this call.</p>
            ) : (
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger id="product">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((product: Product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit-price">Unit Price ($)</Label>
            <Input
              id="unit-price"
              type="number"
              min="0"
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="promotion-notes">Promotion Details (Optional)</Label>
            <Textarea
              id="promotion-notes"
              value={promotionNotes}
              onChange={(e) => setPromotionNotes(e.target.value)}
              placeholder="Special pricing, discounts, bundle offers..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAdding}>
            Cancel
          </Button>
          <Button 
            onClick={handleAdd} 
            disabled={isAdding || !selectedProductId || !unitPrice || availableProducts.length === 0}
          >
            {isAdding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              'Add Product'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
