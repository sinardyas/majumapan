import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { PromotionsList, PromotionEditor, PromotionPreview } from '@/components/promotions';
import type { ApiResponse } from '@pos/api-client';

interface Promotion {
  id: string;
  storeId: string | null;
  name: string;
  description: string | null;
  bannerImageUrl: string;
  discountId: string | null;
  colorTheme: string;
  displayPriority: number;
  displayDuration: number;
  showOnDisplay: boolean;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Discount {
  id: string;
  name: string;
  code: string | null;
}

export default function Promotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [previewPromotion, setPreviewPromotion] = useState<Promotion | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPromotions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get<Promotion[]>('/promotions');
      if (response.success && response.data) {
        setPromotions(response.data);
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch promotions');
      }
    } catch {
      setError('Failed to fetch promotions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDiscounts = useCallback(async () => {
    try {
      const response = await api.get<Discount[]>('/discounts');
      if (response.success && response.data) {
        setDiscounts(response.data);
      }
    } catch {
      console.error('Failed to fetch discounts');
    }
  }, []);

  useEffect(() => {
    fetchPromotions();
    fetchDiscounts();
  }, [fetchPromotions, fetchDiscounts]);

  const handleCreate = () => {
    setEditingPromotion(null);
    setShowEditor(true);
  };

  const handleEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    setShowEditor(true);
  };

  const handleDelete = async (promotion: Promotion) => {
    if (!confirm(`Delete "${promotion.name}"? This cannot be undone.`)) return;

    try {
      const response = await api.delete<null>(`/promotions/${promotion.id}`);
      if (response.success) {
        setPromotions((prev) => prev.filter((p) => p.id !== promotion.id));
      } else {
        alert(response.error || 'Failed to delete promotion');
      }
    } catch {
      alert('Failed to delete promotion');
    }
  };

  const handlePreview = (promotion: Promotion) => {
    setPreviewPromotion(promotion);
    setShowPreview(true);
  };

  const handleReorder = (reorderedPromotions: Promotion[]) => {
    setPromotions(reorderedPromotions);
  };

  const handleSave = async (data: {
    name: string;
    description: string;
    bannerImageUrl: string;
    discountId: string;
    colorTheme: string;
    displayDuration: number;
    showOnDisplay: boolean;
    startDate: string;
    endDate: string;
  }) => {
    setIsSaving(true);
    try {
      const requestData = {
        name: data.name,
        description: data.description || null,
        bannerImageUrl: data.bannerImageUrl,
        discountId: data.discountId || null,
        colorTheme: data.colorTheme,
        displayDuration: data.displayDuration,
        showOnDisplay: data.showOnDisplay,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
      };

      let response: ApiResponse<Promotion>;

      if (editingPromotion) {
        response = await api.put<Promotion>(`/promotions/${editingPromotion.id}`, requestData);
      } else {
        response = await api.post<Promotion>('/promotions', requestData);
      }

      if (response.success && response.data) {
        if (editingPromotion) {
          setPromotions((prev) =>
            prev.map((p) => (p.id === editingPromotion.id ? { ...p, ...response.data! } : p))
          );
        } else {
          setPromotions((prev) => [...prev, response.data!].sort((a, b) => a.displayPriority - b.displayPriority));
        }
        setShowEditor(false);
        setEditingPromotion(null);
      } else {
        alert(response.error || 'Failed to save promotion');
      }
    } catch {
      alert('Failed to save promotion');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Promotions</h1>
        <p className="text-gray-500">Manage customer display promotions</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <PromotionsList
        promotions={promotions}
        isLoading={isLoading}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        onSearchChange={setSearchQuery}
        onStatusFilterChange={setStatusFilter}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPreview={handlePreview}
        onReorder={handleReorder}
      />

      {showEditor && (
        <PromotionEditor
          promotion={
            editingPromotion
              ? {
                  id: editingPromotion.id,
                  name: editingPromotion.name,
                  description: editingPromotion.description ?? undefined,
                  bannerImageUrl: editingPromotion.bannerImageUrl,
                  discountId: editingPromotion.discountId ?? undefined,
                  colorTheme: editingPromotion.colorTheme as 'sunset-orange' | 'ocean-blue' | 'forest-green' | 'royal-purple' | 'cherry-red',
                  displayDuration: editingPromotion.displayDuration,
                  showOnDisplay: editingPromotion.showOnDisplay,
                  startDate: editingPromotion.startDate ?? undefined,
                  endDate: editingPromotion.endDate ?? undefined,
                }
              : undefined
          }
          discounts={discounts}
          onSave={handleSave}
          onCancel={() => {
            setShowEditor(false);
            setEditingPromotion(null);
          }}
          isLoading={isSaving}
        />
      )}

      {showPreview && previewPromotion && (
        <PromotionPreview
          promotions={[
            {
              name: previewPromotion.name,
              description: previewPromotion.description,
              bannerImageUrl: previewPromotion.bannerImageUrl,
              colorTheme: previewPromotion.colorTheme,
              displayDuration: previewPromotion.displayDuration,
            },
          ]}
          onClose={() => {
            setShowPreview(false);
            setPreviewPromotion(null);
          }}
        />
      )}
    </div>
  );
}
