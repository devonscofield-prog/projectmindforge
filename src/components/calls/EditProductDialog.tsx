import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface ProductWithDetails {
  id: string;
  unit_price: number;
  quantity: number;
  promotion_notes: string | null;
  products?: {
    id: string;
    name: string;
    slug: string;
  };
}

interface EditProductDialogProps {
  product: ProductWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (productId: string, updates: { unit_price: number; quantity: number; promotion_notes: string }) => Promise<void>;
}

export function EditProductDialog({ product, open, onOpenChange, onSave }: EditProductDialogProps) {
  const [unitPrice, setUnitPrice] = useState(product.unit_price.toString());
  const [quantity, setQuantity] = useState(product.quantity.toString());
  const [promotionNotes, setPromotionNotes] = useState(product.promotion_notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const price = parseFloat(unitPrice);
    const qty = parseInt(quantity);

    if (isNaN(price) || price < 0) {
      return;
    }
    if (isNaN(qty) || qty < 1) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(product.id, {
        unit_price: price,
        quantity: qty,
        promotion_notes: promotionNotes.trim() || '',
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>
            Update pricing, quantity, or promotion details for {product.products?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
