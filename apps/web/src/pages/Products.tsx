import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { db, type LocalProduct, type LocalCategory } from '@/db';
import { api } from '@/services/api';
import { Button } from '@pos/ui';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSyncStore } from '@/stores/syncStore';
import { AlertTriangle, X, Package } from 'lucide-react';
import { formatCurrency } from '@/hooks/useCurrencyConfig';

interface ProductWithStock extends LocalProduct {
  stockQuantity: number;
  categoryName: string;
}

interface ProductFormData {
  id?: string;
  categoryId: string;
  sku: string;
  barcode: string;
  name: string;
  description: string;
  price: string;
  costPrice: string;
  imageBase64: string;
}

const emptyFormData: ProductFormData = {
  categoryId: '',
  sku: '',
  barcode: '',
  name: '',
  description: '',
  price: '',
  costPrice: '',
  imageBase64: '',
};

export default function Products() {
  const { user } = useAuthStore();
  const { isOnline } = useOnlineStatus();
  const { fullSync } = useSyncStore();
  
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [categories, setCategories] = useState<LocalCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>(emptyFormData);
  const [formError, setFormError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [user?.storeId]);

  const loadData = async () => {
    if (!user?.storeId) {
      setIsLoading(false);
      return;
    }

    try {
      // Load categories
      const cats = await db.categories
        .where('storeId')
        .equals(user.storeId)
        .filter(c => c.isActive === true)
        .toArray();
      setCategories(cats);

      // Load products with stock
      const prods = await db.products
        .where('storeId')
        .equals(user.storeId)
        .toArray();

      const productsWithDetails = await Promise.all(
        prods.map(async (product) => {
          const stockRecord = await db.stock
            .where('[storeId+productId]')
            .equals([user.storeId!, product.id])
            .first();
          const category = cats.find(c => c.id === product.categoryId);
          
          return {
            ...product,
            stockQuantity: stockRecord?.quantity ?? 0,
            categoryName: category?.name || 'Uncategorized',
          };
        })
      );

      setProducts(productsWithDetails);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === 'all' || product.categoryId === selectedCategory;
    const matchesSearch = !searchQuery ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleOpenModal = (product?: ProductWithStock) => {
    if (product) {
      setFormData({
        id: product.id,
        categoryId: product.categoryId || '',
        sku: product.sku,
        barcode: product.barcode || '',
        name: product.name,
        description: product.description || '',
        price: product.price.toString(),
        costPrice: product.costPrice?.toString() || '',
        imageBase64: product.imageBase64 || '',
      });
    } else {
      setFormData(emptyFormData);
    }
    setFormError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(emptyFormData);
    setFormError('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      setFormError('Image must be less than 500KB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, imageBase64: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isOnline) {
      setFormError('You must be online to modify products');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const payload = {
        categoryId: formData.categoryId || undefined,
        sku: formData.sku,
        barcode: formData.barcode || undefined,
        name: formData.name,
        description: formData.description || undefined,
        price: parseFloat(formData.price),
        costPrice: formData.costPrice ? parseFloat(formData.costPrice) : undefined,
        imageBase64: formData.imageBase64 || undefined,
      };

      let response;
      if (formData.id) {
        response = await api.put(`/products/${formData.id}`, payload);
      } else {
        response = await api.post('/products', payload);
      }

      if (response.success) {
        // Refresh local data
        await fullSync();
        await loadData();
        handleCloseModal();
      } else {
        setFormError(response.error || 'Failed to save product');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      setFormError('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!isOnline) {
      alert('You must be online to delete products');
      return;
    }

    if (!confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      const response = await api.delete(`/products/${productId}`);
      
      if (response.success) {
        await fullSync();
        await loadData();
      } else {
        alert(response.error || 'Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('An error occurred');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Show message for admin users without a store assigned
  if (!user?.storeId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center px-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 max-w-md">
          <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Store Assigned</h2>
          <p className="text-gray-600 mb-4">
            Your admin account is not assigned to a specific store. 
            Please use the store selector feature (coming soon) or contact the system administrator.
          </p>
          <p className="text-sm text-amber-600">
            Tip: Login with a manager or cashier account to access store data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600">Manage your product catalog</p>
        </div>
        <Button onClick={() => handleOpenModal()} disabled={!isOnline}>
          Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-full"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="input"
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No products found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-6 py-3 font-medium">Product</th>
                  <th className="px-6 py-3 font-medium">SKU</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium">Price</th>
                  <th className="px-6 py-3 font-medium">Stock</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                          {product.imageBase64 ? (
                            <img
                              src={product.imageBase64}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{product.name}</p>
                          {product.barcode && (
                            <p className="text-xs text-gray-500">{product.barcode}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-mono text-sm">
                      {product.sku}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {product.categoryName}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {formatCurrency(product.price)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-medium ${
                        product.stockQuantity <= 10 ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {product.stockQuantity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        product.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenModal(product)}
                          disabled={!isOnline}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(product.id)}
                          disabled={!isOnline}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {formData.id ? 'Edit Product' : 'Add Product'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="label">SKU *</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                    className="input w-full"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Barcode</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                    className="input w-full"
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    className="input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="label">Cost Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.costPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, costPrice: e.target.value }))}
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="input w-full"
                  rows={3}
                />
              </div>

              <div>
                <label className="label">Product Image</label>
                <div className="flex items-center gap-4">
                  {formData.imageBase64 && (
                    <img
                      src={formData.imageBase64}
                      alt="Preview"
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Max 500KB. JPG, PNG or GIF.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  {formData.id ? 'Update Product' : 'Create Product'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
