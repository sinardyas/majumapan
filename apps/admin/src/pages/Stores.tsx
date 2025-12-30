import { useState } from 'react';
import { useToast } from '@pos/ui';
import { api } from '@/services/api';
import { Button } from '@pos/ui';
import { Modal } from '@pos/ui';
import type { Store } from '@pos/shared';

export default function Stores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    isActive: true,
  });
  const { success, error, addToast } = useToast();

  const fetchStores = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<Store[]>('/stores');
      if (response.success && response.data) {
        setStores(response.data);
      } else {
        error('Error', 'Failed to load stores');
      }
    } catch {
      error('Error', 'Failed to load stores');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingStore) {
        const response = await api.put<Store>(`/stores/${editingStore.id}`, formData);
        if (response.success) {
          success('Success', 'Store updated successfully');
          await fetchStores();
          setShowModal(false);
          setEditingStore(null);
        } else {
          error('Error', response.error || 'Failed to update store');
        }
      } else {
        const response = await api.post<Store>('/stores', formData);
        if (response.success) {
          success('Success', 'Store created successfully');
          await fetchStores();
          setShowModal(false);
        } else {
          error('Error', response.error || 'Failed to create store');
        }
      }
    } catch {
      error('Error', 'An unexpected error occurred');
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
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this store?')) return;
    
    setIsLoading(true);
    try {
      const response = await api.delete(`/stores/${id}`);
      if (response.success) {
        success('Success', 'Store deactivated successfully');
        await fetchStores();
      } else {
        error('Error', response.error || 'Failed to deactivate store');
      }
    } catch {
      error('Error', 'Failed to deactivate store');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setEditingStore(null);
    setFormData({
      name: '',
      address: '',
      phone: '',
      isActive: true,
    });
  };

  useEffect(() => {
    fetchStores();
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stores</h1>
        <Button onClick={() => setShowModal(true)}>New Store</Button>
      </div>

      {isLoading && stores.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((store) => (
            <div key={store.id} className="card">
              <div className="card-body">
                <h3 className="text-lg font-semibold text-gray-900">{store.name}</h3>
                <p className="text-sm text-gray-600 mb-2">
                  {store.address && <div>📍 {store.address}</div>}
                  {store.phone && <div>📞 {store.phone}</div>}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    store.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {store.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="card-footer flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(store)}>
                  Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(store.id)}>
                  Deactivate
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={handleCancel}
        title={editingStore ? 'Edit Store' : 'New Store'}
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="label">Store Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="Enter store name"
                required
              />
            </div>

            <div>
              <label className="label">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="input"
                placeholder="Enter store address"
              />
            </div>

            <div>
              <label className="label">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input"
                placeholder="Enter store phone"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="isActive" className="ml-2 text-sm font-medium text-gray-700">
                Active
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={handleCancel} disabled={isLoading}>
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
