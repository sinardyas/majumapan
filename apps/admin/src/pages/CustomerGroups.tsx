import { useState, useEffect, useCallback } from 'react';
import { Button, Input } from '@pos/ui';
import { Plus, Trash2, Edit, Users, X, DollarSign, Star } from 'lucide-react';
import { customerApi, type CustomerGroup } from '@/services/customer';
import { useToast } from '@pos/ui';

interface GroupFormData {
  name: string;
  minSpend: string;
  minVisits: string;
  priority: string;
}

export default function CustomerGroups() {
  const { success, error: showError } = useToast();
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);
  const [formData, setFormData] = useState<GroupFormData>({
    name: '',
    minSpend: '0',
    minVisits: '0',
    priority: '0',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<CustomerGroup | null>(null);
  const [customerCounts, setCustomerCounts] = useState<Record<string, number>>({});

  const formatCurrency = (amount: string | number | undefined) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'IDR',
    }).format(num);
  };

  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await customerApi.getGroups();
      if (response.success && response.data) {
        setGroups(response.data);
        
        // Load customer counts for each group
        const counts: Record<string, number> = {};
        for (const group of response.data) {
          const countResponse = await customerApi.count({ groupId: group.id });
          if (countResponse.success && countResponse.data) {
            counts[group.id] = countResponse.data.count;
          }
        }
        setCustomerCounts(counts);
      }
    } catch (err) {
      console.error('Error loading groups:', err);
      showError('Failed to load groups');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let response;
      if (editingGroup) {
        response = await customerApi.updateGroup(editingGroup.id, {
          name: formData.name || undefined,
          minSpend: parseFloat(formData.minSpend) || undefined,
          minVisits: parseInt(formData.minVisits) || undefined,
          priority: parseInt(formData.priority) || undefined,
        });
      } else {
        response = await customerApi.createGroup({
          name: formData.name,
          minSpend: parseFloat(formData.minSpend),
          minVisits: parseInt(formData.minVisits),
          priority: parseInt(formData.priority),
        });
      }

      if (response.success) {
        success(editingGroup ? 'Group updated' : 'Group created');
        closeForm();
        loadGroups();
      } else {
        showError(response.error || 'Failed to save group');
      }
    } catch (err) {
      console.error('Error saving group:', err);
      showError('Failed to save group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!groupToDelete) return;

    try {
      const response = await customerApi.deleteGroup(groupToDelete.id);
      if (response.success) {
        success('Group deleted');
        setShowDeleteConfirm(false);
        setGroupToDelete(null);
        loadGroups();
      } else {
        showError(response.error || 'Failed to delete group');
      }
    } catch (err) {
      console.error('Error deleting group:', err);
      showError('Failed to delete group');
    }
  };

  const openEditForm = (group: CustomerGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      minSpend: group.minSpend,
      minVisits: String(group.minVisits),
      priority: String(group.priority),
    });
    setIsFormOpen(true);
  };

  const openCreateForm = () => {
    setEditingGroup(null);
    setFormData({ name: '', minSpend: '0', minVisits: '0', priority: String(groups.length) });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingGroup(null);
    setFormData({ name: '', minSpend: '0', minVisits: '0', priority: '0' });
  };

  const getGroupBadgeClass = (priority: number) => {
    switch (priority) {
      case 3: return 'bg-purple-100 text-purple-700 border-purple-200';
      case 2: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 1: return 'bg-gray-200 text-gray-700 border-gray-300';
      default: return 'bg-orange-100 text-orange-700 border-orange-200';
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 3: return 'VIP';
      case 2: return 'Gold';
      case 1: return 'Silver';
      default: return 'Bronze';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Star className="h-6 w-6" />
            Customer Groups
          </h1>
          <p className="text-gray-600">Manage customer segmentation rules</p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-2" />
          Create Group
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Star className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No groups found</p>
          <Button variant="outline" className="mt-4" onClick={openCreateForm}>
            Create First Group
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium border ${getGroupBadgeClass(group.priority)}`}>
                    {getPriorityLabel(group.priority)}
                  </div>
                  <h3 className="text-lg font-semibold mt-2">{group.name}</h3>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEditForm(group)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setGroupToDelete(group);
                      setShowDeleteConfirm(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <DollarSign className="h-4 w-4" />
                  <span>Min Spend: {formatCurrency(group.minSpend)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Users className="h-4 w-4" />
                  <span>Min Visits: {group.minVisits}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Star className="h-4 w-4" />
                  <span>Priority: {group.priority}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-900">{customerCounts[group.id] || 0}</span> customers in this group
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingGroup ? 'Edit Group' : 'New Group'}
              </h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Group Name *
                  </label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Gold Member"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min Spend (Rp)
                    </label>
                    <Input
                      type="number"
                      value={formData.minSpend}
                      onChange={(e) => setFormData({ ...formData, minSpend: e.target.value })}
                      placeholder="0"
                      min="0"
                      step="1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min Visits
                    </label>
                    <Input
                      type="number"
                      value={formData.minVisits}
                      onChange={(e) => setFormData({ ...formData, minVisits: e.target.value })}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority (higher = more valuable)
                  </label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    placeholder="0"
                    min="0"
                    max="10"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    0=Bronze, 1=Silver, 2=Gold, 3=VIP
                  </p>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeForm}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  {editingGroup ? 'Save Changes' : 'Create Group'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && groupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-2">Delete Group?</h3>
              <p className="text-gray-600">
                Are you sure you want to delete "{groupToDelete.name}"?
                {customerCounts[groupToDelete.id] > 0 && (
                  <span className="text-red-600 block mt-2">
                    This group has {customerCounts[groupToDelete.id]} customers assigned.
                    You must reassign them before deleting.
                  </span>
                )}
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={customerCounts[groupToDelete.id] > 0}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
