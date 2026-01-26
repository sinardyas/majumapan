import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Button, Card, CardContent, Input, Modal, Badge, Skeleton } from '@pos/ui';
import type { Product, Store } from '@pos/shared';
import { z } from 'zod';
import { Plus, Edit, Trash2, Tag, Search, Package } from 'lucide-react';

const productSchema = z.object({
  storeId: z.string().uuid('Please select a store'),
  categoryId: z.string().uuid().optional().nullable(),
  sku: z.string().min(1, 'SKU is required').max(100),
  barcode: z.string().max(100).optional().nullable(),
  name: z.string().min(1, 'Product name is required').max(255),
  description: z.string().max(1000).optional().nullable(),
  price: z.number().positive('Price must be positive'),
  costPrice: z.number().positive().optional().nullable(),
  hasPromo: z.boolean().default(false),
  promoType: z.enum(['percentage', 'fixed']).nullable().optional(),
  promoValue: z.number().positive().nullable().optional(),
  promoMinQty: z.number().int().positive().default(1),
  promoStartDate: z.string().optional().nullable(),
  promoEndDate: z.string().optional().nullable(),
  initialStock: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().positive().default(10),
});

type ProductFormData = z.infer<typeof productSchema>;

interface StoresListData {
  stores: Store[];
  total: number;
}

function toISODateTime(value: string | null | undefined): string | null {
  if (!value || value === '') return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [formData, setFormData] = useState<ProductFormData>({
    storeId: '',
    categoryId: null,
    sku: '',
    barcode: '',
    name: '',
    description: '',
    price: 0,
    costPrice: null,
    hasPromo: false,
    promoType: null,
    promoValue: null,
    promoMinQty: 1,
    promoStartDate: '',
    promoEndDate: '',
    initialStock: 0,
    lowStockThreshold: 10,
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ProductFormData, string>>>({});

  const fetchStores = async () => {
    try {
      const response = await api.get<StoresListData>('/stores');
      if (response.success && response.data) {
        const storesList = response.data.stores || [];
        setStores(storesList);
        if (storesList.length > 0 && !selectedStoreId) {
          setSelectedStoreId(storesList[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load stores:', error);
    }
  };

  const fetchCategories = async (storeId: string) => {
    try {
      const response = await api.get<{ id: string; name: string }[]>(`/categories?storeId=${storeId}`);
      if (response.success && response.data) {
        setCategories(response.data);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
      setCategories([]);
    }
  };

  const fetchProducts = async (storeId: string) => {
    setIsLoading(true);
    try {
      const response = await api.get<any>(`/products?storeId=${storeId}`);
      if (response.success && response.data) {
        const products = response.data.data || response.data;
        const productsArray = Array.isArray(products) ? products : [];
        const normalizedProducts = productsArray.map((p: any) => ({
          ...p,
          price: typeof p.price === 'string' ? parseFloat(p.price) : p.price,
          costPrice: p.costPrice 
            ? (typeof p.costPrice === 'string' ? parseFloat(p.costPrice) : p.costPrice) 
            : null,
          promoValue: p.promoValue 
            ? (typeof p.promoValue === 'string' ? parseFloat(p.promoValue) : p.promoValue) 
            : null,
        }));
        setProducts(normalizedProducts);
        setFilteredProducts(normalizedProducts);
      } else {
        setProducts([]);
        setFilteredProducts([]);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
      setProducts([]);
      setFilteredProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    if (selectedStoreId) {
      fetchCategories(selectedStoreId);
      fetchProducts(selectedStoreId);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = products.filter(product =>
      product.name.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query) ||
      product.barcode?.toLowerCase().includes(query)
    );
    setFilteredProducts(filtered);
  }, [searchQuery, products]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const result = productSchema.safeParse(formData);
    if (!result.success) {
      const errors: Partial<Record<keyof ProductFormData, string>> = {};
      result.error.issues.forEach(issue => {
        const field = issue.path[0] as keyof ProductFormData;
        if (field) {
          errors[field] = issue.message;
        }
      });
      setFormErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      // Convert datetime-local format to ISO 8601
      const payload = {
        ...formData,
        promoStartDate: toISODateTime(formData.promoStartDate),
        promoEndDate: toISODateTime(formData.promoEndDate),
      };

      if (editingProduct) {
        const response = await api.put<Product>(`/products/${editingProduct.id}`, payload);
        if (response.success) {
          await fetchProducts(selectedStoreId);
          setShowModal(false);
          setEditingProduct(null);
          resetForm();
        }
      } else {
        const response = await api.post<Product>('/products', payload);
        if (response.success) {
          await fetchProducts(selectedStoreId);
          setShowModal(false);
          resetForm();
        }
      }
    } catch (error) {
      console.error('Failed to save product:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (product: Product) => {
    const normalizePrice = (price: number | string): number => {
      return typeof price === 'string' ? parseFloat(price) : price;
    };

    setEditingProduct(product);
    setFormData({
      storeId: product.storeId,
      categoryId: product.categoryId || null,
      sku: product.sku,
      barcode: product.barcode || '',
      name: product.name,
      description: product.description || '',
      price: normalizePrice(product.price),
      costPrice: product.costPrice ? normalizePrice(product.costPrice) : null,
      hasPromo: product.hasPromo,
      promoType: product.promoType,
      promoValue: product.promoValue ? normalizePrice(product.promoValue) : null,
      promoMinQty: product.promoMinQty,
      promoStartDate: product.promoStartDate ? new Date(product.promoStartDate).toISOString().slice(0, 16) : '',
      promoEndDate: product.promoEndDate ? new Date(product.promoEndDate).toISOString().slice(0, 16) : '',
      initialStock: 0,
      lowStockThreshold: 10,
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this product?')) return;

    setIsLoading(true);
    try {
      const response = await api.delete(`/products/${id}`);
      if (response.success) {
        await fetchProducts(selectedStoreId);
      }
    } catch (error) {
      console.error('Failed to deactivate product:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      storeId: selectedStoreId,
      categoryId: null,
      sku: '',
      barcode: '',
      name: '',
      description: '',
      price: 0,
      costPrice: null,
      hasPromo: false,
      promoType: null,
      promoValue: null,
      promoMinQty: 1,
      promoStartDate: '',
      promoEndDate: '',
      initialStock: 0,
      lowStockThreshold: 10,
    });
    setFormErrors({});
  };

  const handleCancel = () => {
    setShowModal(false);
    setEditingProduct(null);
    resetForm();
  };

  const getPromoLabel = (product: Product): string | null => {
    if (!product.hasPromo || !product.promoType || product.promoValue === null) {
      return null;
    }
    if (product.promoType === 'percentage') {
      return `${product.promoValue}% OFF`;
    }
    return `$${product.promoValue} OFF`;
  };

  if (isLoading && products.length === 0 && stores.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <Button onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Product
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="w-64">
          <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Select store...</option>
            {stores.map(store => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search products by name, SKU, or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {!selectedStoreId ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">Please select a store to view products</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {searchQuery ? 'No products match your search' : 'No products yet. Create your first product!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{product.name}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={product.isActive ? 'success' : 'outline'}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {getPromoLabel(product) && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {getPromoLabel(product)}
                          {product.promoMinQty > 1 && ` (Min ${product.promoMinQty})`}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-1 text-sm text-gray-600">
                  <p><span className="font-medium">SKU:</span> {product.sku}</p>
                  {product.barcode && <p><span className="font-medium">Barcode:</span> {product.barcode}</p>}
                  <p><span className="font-medium">Price:</span> ${product.price.toFixed(2)}</p>
                </div>
              </CardContent>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(product)}>
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(product.id)}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Deactivate
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={handleCancel} title={editingProduct ? 'Edit Product' : 'New Product'}>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {!editingProduct && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Store *</label>
                <select
                  value={formData.storeId}
                  onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select store...</option>
                  {stores.map(store => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
                {formErrors.storeId && <p className="text-sm text-red-500">{formErrors.storeId}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">SKU *</label>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="e.g., PROD-001"
                />
                {formErrors.sku && <p className="text-sm text-red-500">{formErrors.sku}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Barcode</label>
                <Input
                  value={formData.barcode || ''}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="Optional barcode"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Product name"
              />
              {formErrors.name && <p className="text-sm text-red-500">{formErrors.name}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Product description"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Price *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                />
                {formErrors.price && <p className="text-sm text-red-500">{formErrors.price}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Cost Price</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.costPrice || ''}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Category</label>
              <select
                value={formData.categoryId || ''}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value || null })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">No category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {!editingProduct && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Initial Stock</label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.initialStock}
                    onChange={(e) => setFormData({ ...formData, initialStock: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Low Stock Alert</label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.lowStockThreshold}
                    onChange={(e) => setFormData({ ...formData, lowStockThreshold: parseInt(e.target.value) || 10 })}
                  />
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="hasPromo"
                  checked={formData.hasPromo}
                  onChange={(e) => setFormData({ ...formData, hasPromo: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="hasPromo" className="text-sm font-medium text-gray-700">
                  Enable Product Promo
                </label>
              </div>

              {formData.hasPromo && (
                <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Promo Type</label>
                      <select
                        value={formData.promoType || ''}
                        onChange={(e) => setFormData({ ...formData, promoType: e.target.value as 'percentage' | 'fixed' || null })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Select type...</option>
                        <option value="percentage">Percentage</option>
                        <option value="fixed">Fixed Amount</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Value</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.promoValue || ''}
                        onChange={(e) => setFormData({ ...formData, promoValue: e.target.value ? parseFloat(e.target.value) : null })}
                        placeholder={formData.promoType === 'percentage' ? 'e.g., 30 for 30%' : 'e.g., 5 for $5'}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Minimum Quantity</label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.promoMinQty}
                      onChange={(e) => setFormData({ ...formData, promoMinQty: parseInt(e.target.value) || 1 })}
                    />
                    <p className="text-xs text-gray-500">Minimum quantity to trigger the promo</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Start Date</label>
                      <Input
                        type="datetime-local"
                        value={formData.promoStartDate || ''}
                        onChange={(e) => setFormData({ ...formData, promoStartDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">End Date</label>
                      <Input
                        type="datetime-local"
                        value={formData.promoEndDate || ''}
                        onChange={(e) => setFormData({ ...formData, promoEndDate: e.target.value })}
                      />
                    </div>
                  </div>

                  {formData.promoType && formData.promoValue && (
                    <div className="text-sm text-gray-600 bg-white p-3 rounded border">
                      <strong>Preview:</strong> {formData.promoType === 'percentage' 
                        ? `${formData.promoValue}% off` 
                        : `$${formData.promoValue} off`}
                      {formData.promoMinQty > 1 && ` when buying ${formData.promoMinQty}+ items`}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
            <Button type="button" variant="secondary" onClick={handleCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {editingProduct ? 'Update Product' : 'Create Product'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
