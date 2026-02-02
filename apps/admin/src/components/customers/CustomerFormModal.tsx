import { useState, useEffect } from 'react';
import { Modal, Input, Select, Button } from '@pos/ui';
import { customerApi } from '@/services/customer';
import type { Customer, CustomerGroup, CustomerFormData } from '@/types/customer';
import { AlertCircle } from 'lucide-react';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingCustomer?: Customer | null;
  groups: CustomerGroup[];
}

const customerSchema = {
  phone: (value: string) => {
    if (!value) return 'Phone number is required';
    if (value.length < 10) return 'Phone number must be at least 10 characters';
    return null;
  },
  name: (value: string) => {
    if (value && value.length > 100) return 'Name must be less than 100 characters';
    return null;
  },
  email: (value: string) => {
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Please enter a valid email address';
    }
    return null;
  },
};

export function CustomerFormModal({
  isOpen,
  onClose,
  onSuccess,
  editingCustomer,
  groups,
}: CustomerFormModalProps) {
  const [formData, setFormData] = useState<CustomerFormData>({
    phone: '',
    name: '',
    email: '',
    customerGroupId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (editingCustomer) {
        setFormData({
          phone: editingCustomer.phone,
          name: editingCustomer.name || '',
          email: editingCustomer.email || '',
          customerGroupId: editingCustomer.customerGroupId || '',
        });
      } else {
        setFormData({
          phone: '',
          name: '',
          email: '',
          customerGroupId: '',
        });
      }
      setErrors({});
      setServerError(null);
    }
  }, [isOpen, editingCustomer]);

  const handleChange = (field: keyof CustomerFormData, value: string) => {
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

    ['phone', 'name', 'email'].forEach((field) => {
      const validateFn = customerSchema[field as keyof typeof customerSchema];
      const value = formData[field as keyof CustomerFormData] || '';
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
      if (editingCustomer) {
        await customerApi.update(editingCustomer.id, {
          name: formData.name || undefined,
          email: formData.email || undefined,
          customerGroupId: formData.customerGroupId || undefined,
        });
      } else {
        await customerApi.create({
          phone: formData.phone,
          name: formData.name || undefined,
          email: formData.email || undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      setServerError(error?.message || 'Failed to save customer');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingCustomer ? 'Edit Customer' : 'Add Customer'}
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
            label="Phone Number *"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="0812-3456-7890"
            error={errors.phone}
            disabled={!!editingCustomer}
            required
          />

          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="John Doe"
            error={errors.name}
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="john@example.com"
            error={errors.email}
          />

          {editingCustomer && groups.length > 0 && (
            <Select
              label="Customer Group"
              value={formData.customerGroupId}
              onChange={(e) => handleChange('customerGroupId', e.target.value)}
            >
              <option value="">No Group</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
          )}
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
            {editingCustomer ? 'Save Changes' : 'Create Customer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
