import { useState, useRef } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
import type { ColorThemeId } from './ColorThemePicker';

interface PromotionFormData {
  name: string;
  description: string;
  bannerImageUrl: string;
  discountId: string;
  colorTheme: ColorThemeId;
  displayDuration: number;
  showOnDisplay: boolean;
  startDate: string;
  endDate: string;
}

interface PromotionEditorProps {
  promotion?: Partial<PromotionFormData> & { id?: string };
  discounts: Array<{ id: string; name: string; code: string | null }>;
  onSave: (data: PromotionFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const emptyForm: PromotionFormData = {
  name: '',
  description: '',
  bannerImageUrl: '',
  discountId: '',
  colorTheme: 'sunset-orange',
  displayDuration: 5,
  showOnDisplay: true,
  startDate: '',
  endDate: '',
};

export function PromotionEditor({
  promotion = {},
  discounts,
  onSave,
  onCancel,
  isLoading,
}: PromotionEditorProps) {
  const [formData, setFormData] = useState<PromotionFormData>({
    ...emptyForm,
    ...promotion,
    discountId: promotion.discountId || '',
  });
  const [imagePreview, setImagePreview] = useState<string | null>(promotion.bannerImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('File too large. Maximum size is 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setFormData((prev) => ({ ...prev, bannerImageUrl: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Name is required');
      return;
    }
    if (!imagePreview) {
      alert('Banner image is required');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {promotion.id ? 'Edit Promotion' : 'New Promotion'}
          </h2>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 rounded"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Summer Sale 2026"
              required
              disabled={isLoading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Save 20% on all summer items!"
              disabled={isLoading}
            />
          </div>

          {/* Banner Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Banner Image *
            </label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-40 mx-auto rounded"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setFormData((prev) => ({ ...prev, bannerImageUrl: '' }));
                    }}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded hover:bg-red-600"
                    disabled={isLoading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 text-gray-500 hover:text-gray-700"
                  disabled={isLoading}
                >
                  <Upload className="w-8 h-8" />
                  <span className="text-sm">Click to upload image</span>
                  <span className="text-xs text-gray-400">
                    1920x600px, max 2MB, JPG/PNG/WebP
                  </span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageUpload}
                className="hidden"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Discount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Linked Discount (Optional)
            </label>
            <select
              value={formData.discountId}
              onChange={(e) => setFormData((prev) => ({ ...prev, discountId: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            >
              <option value="">No discount linked</option>
              {discounts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.code ? `(${d.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Color Theme */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color Theme
            </label>
            <div className="grid grid-cols-5 gap-2">
              {['sunset-orange', 'ocean-blue', 'forest-green', 'royal-purple', 'cherry-red'].map((theme) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, colorTheme: theme as ColorThemeId }))}
                  className={`aspect-square rounded-lg border-2 transition-all ${
                    formData.colorTheme === theme
                      ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-2'
                      : 'border-transparent hover:border-gray-400'
                  } ${
                    theme === 'sunset-orange' ? 'bg-gradient-to-br from-orange-500 to-red-500' :
                    theme === 'ocean-blue' ? 'bg-gradient-to-br from-blue-500 to-cyan-500' :
                    theme === 'forest-green' ? 'bg-gradient-to-br from-green-500 to-emerald-500' :
                    theme === 'royal-purple' ? 'bg-gradient-to-br from-purple-500 to-indigo-500' :
                    'bg-gradient-to-br from-red-500 to-rose-500'
                  }`}
                  disabled={isLoading}
                />
              ))}
            </div>
          </div>

          {/* Display Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Duration (seconds)
            </label>
            <input
              type="number"
              value={formData.displayDuration}
              onChange={(e) => setFormData((prev) => ({ ...prev, displayDuration: parseInt(e.target.value) || 5 }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min={1}
              max={30}
              disabled={isLoading}
            />
          </div>

          {/* Show on Display */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showOnDisplay"
              checked={formData.showOnDisplay}
              onChange={(e) => setFormData((prev) => ({ ...prev, showOnDisplay: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled={isLoading}
            />
            <label htmlFor="showOnDisplay" className="text-sm text-gray-700">
              Show on Customer Display
            </label>
          </div>

          {/* Active Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="datetime-local"
                value={formData.startDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
