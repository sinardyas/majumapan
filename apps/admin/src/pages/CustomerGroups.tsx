import { useState, useEffect } from 'react';
import { customerGroupApi } from '@/services/customer-group';
import { GroupFormModal } from '@/components/groups/GroupFormModal';
import type { CustomerGroup } from '@/types/customer-group';
import { Button, Card, Skeleton } from '@pos/ui';
import { Plus, Edit, Trash2, Users, Star } from 'lucide-react';

export default function CustomerGroups() {
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const response = await customerGroupApi.list();
      if (response.success && response.data) {
        setGroups(response.data);
        
        // Fetch member counts for each group
        const counts: Record<string, number> = {};
        for (const group of response.data) {
          counts[group.id] = await customerGroupApi.getMemberCount(group.id);
        }
        setMemberCounts(counts);
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleDelete = async (id: string) => {
    const count = memberCounts[id] || 0;
    if (count > 0) {
      alert(`Cannot delete this group because it has ${count} customer(s) assigned. Please reassign them first.`);
      return;
    }

    if (!confirm('Are you sure you want to delete this group?')) return;

    try {
      await customerGroupApi.delete(id);
      fetchGroups();
    } catch (error: any) {
      alert(error?.message || 'Failed to delete group');
    }
  };

  const handleSuccess = () => {
    fetchGroups();
  };

  const openEditModal = (group: CustomerGroup) => {
    setEditingGroup(group);
    setShowModal(true);
  };

  const openAddModal = () => {
    setEditingGroup(null);
    setShowModal(true);
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 3) return 'bg-purple-100 text-purple-800';
    if (priority >= 2) return 'bg-yellow-100 text-yellow-800';
    if (priority >= 1) return 'bg-gray-100 text-gray-800';
    return 'bg-orange-100 text-orange-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Groups</h1>
          <p className="text-gray-600">Manage customer segmentation groups</p>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4 mr-2" />
          Create Group
        </Button>
      </div>

      <Card className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            {groups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No customer groups found. Create one to get started.
              </div>
            ) : (
              groups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-100">
                      <Star className="h-6 w-6 text-primary-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{group.name}</h3>
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityBadge(group.priority)}`}>
                          Priority: {group.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span>Min Spend: Rp {Number(group.minSpend).toLocaleString('id-ID')}</span>
                        <span>Min Visits: {group.minVisits}</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {memberCounts[group.id] || 0} members
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(group)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(group.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      <GroupFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
        editingGroup={editingGroup || undefined}
      />
    </div>
  );
}
