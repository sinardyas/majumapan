import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Button, Card, CardContent, Input, Modal, Badge, Skeleton } from '@pos/ui';
import type { Store } from '@pos/shared';
import { z } from 'zod';
import { Plus, Edit, Trash2, MapPin, Phone, Search } from 'lucide-react';

const storeSchema = z.object({
  name: z.string().min(1, 'Store name is required'),
  address: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().default(true),
});

type StoreFormData = z.infer<typeof storeSchema>;

export default function Stores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<StoreFormData>({
    name: '',
    address: '',
    phone: '',
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof StoreFormData, string>>>({});

  const fetchStores = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<Store[]>('/stores');
      if (response.success && response.data) {
        setStores(response.data);
        setFilteredStores(response.data);
      }
    } catch {
      console.error('Failed to load stores');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = stores.filter(store =>
      store.name.toLowerCase().includes(query) ||
      store.address?.toLowerCase().includes(query) ||
      store.phone?.includes(query)
    );
    setFilteredStores(filtered);
  }, [searchQuery, stores]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const result = storeSchema.safeParse(formData);
    if (!result.success) {
      const errors: Partial<Record<keyof StoreFormData, string>> = {};
      result.error.issues.forEach(issue => {
        const field = issue.path[0] as keyof StoreFormData;
        if (field) {
          errors[field] = issue.message;
        }
      });
      setFormErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      if (editingStore) {
        const response = await api.put<Store>(`/stores/${editingStore.id}`, formData);
        if (response.success) {
          await fetchStores();
          setShowModal(false);
          setEditingStore(null);
          resetForm();
        }
      } else {
        const response = await api.post<Store>('/stores', formData);
        if (response.success) {
          await fetchStores();
          setShowModal(false);
          resetForm();
        }
      }
    } catch {
      console.error('Failed to save store');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (store: Store) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      address: store.address || '',
      phone: store.phone || '',
      isActive: store.isActive,
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this store?')) return;

    setIsLoading(true);
    try {
      const response = await api.delete(`/stores/${id}`);
      if (response.success) {
        await fetchStores();
      }
    } catch {
      console.error('Failed to deactivate store');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      phone: '',
      isActive: true,
    });
    setFormErrors({});
  };

  const handleCancel = () => {
    setShowModal(false);
    setEditingStore(null);
    resetForm();
  };

  if (isLoading && stores.length === 0) {
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
        <h1 className="text-2xl font-bold text-gray-900">Stores</h1>
        <Button onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Store
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search stores..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-4 py-2 w-full max-w-md border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {filteredStores.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {searchQuery ? 'No stores match your search' : 'No stores yet. Create your first store!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStores.map((store) => (
            <Card key={store.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-gray-900">{store.name}</h3>
                    <Badge variant={store.isActive ? 'success' : 'outline'}>
                      {store.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>

                {(store.address || store.phone) && (
                  <div className="mt-4 space-y-2">
                    {store.address && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span>{store.address}</span>
                      </div>
                    )}
                    {store.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        <span>{store.phone}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(store)}>
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(store.id)}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Deactivate
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={handleCancel} title={editingStore ? 'Edit Store' : 'New Store'}>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Store Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter store name"
              />
              {formErrors.name && <p className="text-sm text-red-500">{formErrors.name}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Address</label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter store address"
              />
              {formErrors.address && <p className="text-sm text-red-500">{formErrors.address}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Phone</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Enter store phone"
              />
              {formErrors.phone && <p className="text-sm text-red-500">{formErrors.phone}</p>}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                Active
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={handleCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {editingStore ? 'Update Store' : 'Create Store'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
