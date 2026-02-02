import { useState, useEffect } from 'react';
import { Modal, Input, Button } from '@pos/ui';
import { customerGroupApi } from '@/services/customer-group';
import type { CustomerGroup, CustomerGroupFormData } from '@/types/customer-group';
import { AlertCircle } from 'lucide-react';

interface GroupFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingGroup?: CustomerGroup | null;
}

const groupSchema = {
  name: (value: string) => {
    if (!value) return 'Group name is required';
    if (value.length > 50) return 'Group name must be less than 50 characters';
    return null;
  },
  minSpend: (value: string) => {
    if (value && isNaN(Number(value))) return 'Must be a valid number';
    if (value && Number(value) < 0) return 'Cannot be negative';
    return null;
  },
  minVisits: (value: string) => {
    if (value && isNaN(Number(value))) return 'Must be a valid number';
    if (value && Number(value) < 0) return 'Cannot be negative';
    return null;
  },
  priority: (value: string) => {
    if (value && isNaN(Number(value))) return 'Must be a valid number';
    return null;
  },
};

export function GroupFormModal({
  isOpen,
  onClose,
  onSuccess,
  editingGroup,
}: GroupFormModalProps) {
  const [formData, setFormData] = useState<CustomerGroupFormData>({
    name: '',
    minSpend: '0',
    minVisits: '0',
    priority: '0',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (editingGroup) {
        setFormData({
          name: editingGroup.name,
          minSpend: editingGroup.minSpend,
          minVisits: String(editingGroup.minVisits),
          priority: String(editingGroup.priority),
        });
      } else {
        setFormData({
          name: '',
          minSpend: '0',
          minVisits: '0',
          priority: '0',
        });
      }
      setErrors({});
      setServerError(null);
    }
  }, [isOpen, editingGroup]);

  const handleChange = (field: keyof CustomerGroupFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const newErrors: Record<string, string> = {};
    let isValid = true;

    ['name', 'minSpend', 'minVisits', 'priority'].forEach((field) => {
      const validateFn = groupSchema[field as keyof typeof groupSchema];
      const value = formData[field as keyof CustomerGroupFormData] || '';
      const error = validateFn(value);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    if (!isValid) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      if (editingGroup) {
        await customerGroupApi.update(editingGroup.id, {
          name: formData.name,
          minSpend: Number(formData.minSpend) || undefined,
          minVisits: Number(formData.minVisits) || undefined,
          priority: Number(formData.priority) || undefined,
        });
      } else {
        await customerGroupApi.create({
          name: formData.name,
          minSpend: Number(formData.minSpend) || undefined,
          minVisits: Number(formData.minVisits) || undefined,
          priority: Number(formData.priority) || undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      setServerError(error?.message || 'Failed to save group');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingGroup ? 'Edit Customer Group' : 'Create Customer Group'}
    >
      <form onSubmit={handleSubmit}>
        {serverError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-700">{serverError}</span>
          </div>
        )}

        <div className="space-y-4">
          <Input
            label="Group Name *"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g., VIP, Gold, Silver"
            error={errors.name}
            required
          />

          <Input
            label="Minimum Spend (Rp)"
            type="number"
            value={formData.minSpend}
            onChange={(e) => handleChange('minSpend', e.target.value)}
            placeholder="0"
            error={errors.minSpend}
          />

          <Input
            label="Minimum Visits"
            type="number"
            value={formData.minVisits}
            onChange={(e) => handleChange('minVisits', e.target.value)}
            placeholder="0"
            error={errors.minVisits}
          />

          <Input
            label="Priority"
            type="number"
            value={formData.priority}
            onChange={(e) => handleChange('priority', e.target.value)}
            placeholder="0"
            error={errors.priority}
          />

          <p className="text-sm text-gray-500">
            Higher priority groups are evaluated first for auto-assignment.
          </p>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isLoading}
          >
            {editingGroup ? 'Save Changes' : 'Create Group'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
