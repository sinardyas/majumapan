import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { db, type LocalCategory } from '@/db';
import { api } from '@/services/api';
import { Button } from '@pos/ui';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSyncStore } from '@/stores/syncStore';

interface CategoryWithCount extends LocalCategory {
  productCount: number;
}

interface CategoryFormData {
  id?: string;
  name: string;
  description: string;
}

const emptyFormData: CategoryFormData = {
  name: '',
  description: '',
};

export default function Categories() {
  const { user } = useAuthStore();
  const { isOnline } = useOnlineStatus();
  const { fullSync } = useSyncStore();
  
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CategoryFormData>(emptyFormData);
  const [formError, setFormError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, [user?.storeId]);

  const loadData = async () => {
    if (!user?.storeId) {
      setIsLoading(false);
      return;
    }

    try {
      const cats = await db.categories
        .where({ storeId: user.storeId })
        .toArray();

      // Get product count for each category
      const categoriesWithCount = await Promise.all(
        cats.map(async (category) => {
          const productCount = await db.products
            .where({ categoryId: category.id, storeId: user.storeId! })
            .count();
          
          return {
            ...category,
            productCount,
          };
        })
      );

      setCategories(categoriesWithCount);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCategories = categories.filter((category) => {
    return !searchQuery ||
      category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category.description?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleOpenModal = (category?: CategoryWithCount) => {
    if (category) {
      setFormData({
        id: category.id,
        name: category.name,
        description: category.description || '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isOnline) {
      setFormError('You must be online to modify categories');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const payload = {
        name: formData.name,
        description: formData.description || undefined,
      };

      let response;
      if (formData.id) {
        response = await api.put(`/categories/${formData.id}`, payload);
      } else {
        response = await api.post('/categories', payload);
      }

      if (response.success) {
        await fullSync();
        await loadData();
        handleCloseModal();
      } else {
        setFormError(response.error || 'Failed to save category');
      }
    } catch (error) {
      console.error('Error saving category:', error);
      setFormError('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (!isOnline) {
      alert('You must be online to delete categories');
      return;
    }

    const category = categories.find(c => c.id === categoryId);
    if (category && category.productCount > 0) {
      alert('Cannot delete category with products. Move or delete the products first.');
      return;
    }

    if (!confirm('Are you sure you want to delete this category?')) {
      return;
    }

    try {
      const response = await api.delete(`/categories/${categoryId}`);
      
      if (response.success) {
        await fullSync();
        await loadData();
      } else {
        alert(response.error || 'Failed to delete category');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
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
          <svg className="h-16 w-16 text-amber-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
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
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-600">Organize your products with categories</p>
        </div>
        <Button onClick={() => handleOpenModal()} disabled={!isOnline}>
          Add Category
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input w-full max-w-md"
        />
      </div>

      {/* Categories Grid */}
      {filteredCategories.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
          <svg className="h-16 w-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <p>No categories found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCategories.map((category) => (
            <div
              key={category.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-primary-100 flex items-center justify-center">
                    <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{category.name}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      category.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {category.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {category.description && (
                <p className="text-sm text-gray-600 mb-4">{category.description}</p>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <span className="text-sm text-gray-500">
                  {category.productCount} product{category.productCount !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenModal(category)}
                    disabled={!isOnline}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(category.id)}
                    disabled={!isOnline || category.productCount > 0}
                    className="text-red-600 hover:text-red-700"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {formData.id ? 'Edit Category' : 'Add Category'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {formError}
                </div>
              )}

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
                <label className="label">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="input w-full"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  {formData.id ? 'Update Category' : 'Create Category'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
