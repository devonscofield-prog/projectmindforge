import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getCallProducts, updateCallProduct, deleteCallProduct, insertCallProducts, updateProspectActiveRevenue, CallProduct } from '@/api/callProducts';
import { EditProductDialog } from './EditProductDialog';
import { AddProductToCallDialog } from './AddProductToCallDialog';
import { Package, DollarSign, Hash, Tag, Pencil, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/lib/logger';

const log = createLogger('CallProductsSummary');

interface CallProductsSummaryProps {
  callId: string;
  prospectId: string | null;
  isOwner: boolean;
}

interface ProductWithDetails {
  id: string;
  call_id: string;
  product_id: string;
  unit_price: number;
  quantity: number;
  promotion_notes: string | null;
  created_at: string | null;
  products?: {
    id: string;
    name: string;
    slug: string;
  };
}

export function CallProductsSummary({ callId, prospectId, isOwner }: CallProductsSummaryProps) {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<ProductWithDetails | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  const loadProducts = async () => {
    try {
      const data = await getCallProducts(callId);
      setProducts(data as ProductWithDetails[]);
    } catch (error) {
      log.error('Error loading products', { error, callId });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [callId]);

  const handleSaveProduct = async (productId: string, updates: { unit_price: number; quantity: number; promotion_notes: string }) => {
    try {
      await updateCallProduct(productId, updates);
      await loadProducts();
      
      // Update prospect active revenue if linked
      if (prospectId) {
        await updateProspectActiveRevenue(prospectId);
      }

      toast({
        title: 'Product updated',
        description: 'Product information has been updated successfully.',
      });
    } catch (error) {
      log.error('Error updating product', { error, productId });
      toast({
        title: 'Error',
        description: 'Failed to update product information.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteCallProduct(productId);
      await loadProducts();
      
      // Update prospect active revenue if linked
      if (prospectId) {
        await updateProspectActiveRevenue(prospectId);
      }

      toast({
        title: 'Product removed',
        description: 'Product has been removed from this call.',
      });
    } catch (error) {
      log.error('Error deleting product', { error, productId });
      toast({
        title: 'Error',
        description: 'Failed to remove product.',
        variant: 'destructive',
      });
    }
  };

  const handleAddProduct = async (productId: string, unitPrice: number, quantity: number, promotionNotes: string) => {
    try {
      await insertCallProducts(callId, [{
        productId,
        unitPrice,
        quantity,
        promotionNotes: promotionNotes || undefined,
      }]);
      await loadProducts();
      
      // Update prospect active revenue if linked
      if (prospectId) {
        await updateProspectActiveRevenue(prospectId);
      }

      toast({
        title: 'Product added',
        description: 'Product has been added to this call.',
      });
    } catch (error) {
      log.error('Error adding product', { error });
      toast({
        title: 'Error',
        description: 'Failed to add product.',
        variant: 'destructive',
      });
    }
  };

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
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Products Discussed
          </CardTitle>
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => setIsAddingProduct(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
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
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono">
                      {formatCurrency(product.unit_price * product.quantity)}
                    </Badge>
                    {isOwner && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingProduct(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingProductId(product.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
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

      {/* Edit Product Dialog */}
      {editingProduct && (
        <EditProductDialog
          product={editingProduct}
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
          onSave={handleSaveProduct}
        />
      )}

      {/* Add Product Dialog */}
      <AddProductToCallDialog
        open={isAddingProduct}
        onOpenChange={setIsAddingProduct}
        existingProductIds={products.map(p => p.product_id)}
        onAdd={handleAddProduct}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingProductId} onOpenChange={(open) => !open && setDeletingProductId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this product from the call? This will update the total revenue for this account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingProductId) {
                  handleDeleteProduct(deletingProductId);
                  setDeletingProductId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
