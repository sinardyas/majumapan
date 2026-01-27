import { useState, useCallback } from 'react';
import { Button, Input } from '@pos/ui';
import { voucherApi, type Voucher } from '@/services/voucher';
import { X, Gift, Percent, Tag, DollarSign } from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
}

interface VoucherRuleBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (voucher: Voucher) => void;
  categories?: Category[];
  products?: Product[];
}

type DiscountType = 'PERCENTAGE' | 'FIXED' | 'FREE_ITEM';
type Scope = 'ENTIRE_ORDER' | 'ITEMS_ONLY' | 'SUBTOTAL' | 'SPECIFIC_ITEMS';
type FreeItemMode = 'AUTO_ADD' | 'QUALIFY_FIRST';

interface VoucherFormData {
  discountType: DiscountType;
  percentageValue: string;
  fixedValue: string;
  scope: Scope;
  freeItemId: string;
  freeItemMode: FreeItemMode;
  minPurchase: string;
  maxDiscount: string;
  expiresAt: string;
  applicableCategories: string[];
  applicableProducts: string[];
  qualifierCategories: string[];
  qualifierProducts: string[];
  notes: string;
}

export function VoucherRuleBuilder({
  isOpen,
  onClose,
  onSuccess,
  categories = [],
  products = [],
}: VoucherRuleBuilderProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<VoucherFormData>({
    discountType: 'PERCENTAGE',
    percentageValue: '',
    fixedValue: '',
    scope: 'ENTIRE_ORDER',
    freeItemId: '',
    freeItemMode: 'AUTO_ADD',
    minPurchase: '',
    maxDiscount: '',
    expiresAt: '',
    applicableCategories: [],
    applicableProducts: [],
    qualifierCategories: [],
    qualifierProducts: [],
    notes: '',
  });

  const handleDiscountTypeChange = useCallback((type: DiscountType) => {
    setFormData(prev => ({
      ...prev,
      discountType: type,
      scope: type === 'FREE_ITEM' ? 'ENTIRE_ORDER' : prev.scope,
    }));
  }, []);

  const handleScopeChange = useCallback((scope: Scope) => {
    setFormData(prev => ({ ...prev, scope }));
  }, []);

  const handleAddApplicableCategory = useCallback((categoryId: string) => {
    if (categoryId && !formData.applicableCategories.includes(categoryId)) {
      setFormData(prev => ({
        ...prev,
        applicableCategories: [...prev.applicableCategories, categoryId],
      }));
    }
  }, [formData.applicableCategories]);

  const handleRemoveApplicableCategory = useCallback((categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      applicableCategories: prev.applicableCategories.filter(id => id !== categoryId),
    }));
  }, []);

  const handleAddApplicableProduct = useCallback((productId: string) => {
    if (productId && !formData.applicableProducts.includes(productId)) {
      setFormData(prev => ({
        ...prev,
        applicableProducts: [...prev.applicableProducts, productId],
      }));
    }
  }, [formData.applicableProducts]);

  const handleRemoveApplicableProduct = useCallback((productId: string) => {
    setFormData(prev => ({
      ...prev,
      applicableProducts: prev.applicableProducts.filter(id => id !== productId),
    }));
  }, []);

  const handleAddQualifierCategory = useCallback((categoryId: string) => {
    if (categoryId && !formData.qualifierCategories.includes(categoryId)) {
      setFormData(prev => ({
        ...prev,
        qualifierCategories: [...prev.qualifierCategories, categoryId],
      }));
    }
  }, [formData.qualifierCategories]);

  const handleRemoveQualifierCategory = useCallback((categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      qualifierCategories: prev.qualifierCategories.filter(id => id !== categoryId),
    }));
  }, []);

  const handleAddQualifierProduct = useCallback((productId: string) => {
    if (productId && !formData.qualifierProducts.includes(productId)) {
      setFormData(prev => ({
        ...prev,
        qualifierProducts: [...prev.qualifierProducts, productId],
      }));
    }
  }, [formData.qualifierProducts]);

  const handleRemoveQualifierProduct = useCallback((productId: string) => {
    setFormData(prev => ({
      ...prev,
      qualifierProducts: prev.qualifierProducts.filter(id => id !== productId),
    }));
  }, []);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let response;
      
      if (formData.discountType === 'FREE_ITEM') {
        response = await voucherApi.createPromo({
          discountType: 'FREE_ITEM',
          freeItemId: formData.freeItemId,
          freeItemMode: formData.freeItemMode,
          expiresAt: formData.expiresAt,
          qualifierCategories: formData.qualifierCategories.length > 0 ? formData.qualifierCategories : undefined,
          qualifierProducts: formData.qualifierProducts.length > 0 ? formData.qualifierProducts : undefined,
          notes: formData.notes || undefined,
        });
      } else {
        response = await voucherApi.createPromo({
          discountType: formData.discountType,
          percentageValue: formData.discountType === 'PERCENTAGE' ? Number(formData.percentageValue) : undefined,
          fixedValue: formData.discountType === 'FIXED' ? Number(formData.fixedValue) : undefined,
          scope: formData.scope,
          minPurchase: formData.minPurchase ? Number(formData.minPurchase) : undefined,
          maxDiscount: formData.maxDiscount ? Number(formData.maxDiscount) : undefined,
          expiresAt: formData.expiresAt,
          applicableCategories: formData.applicableCategories.length > 0 && formData.scope === 'SPECIFIC_ITEMS' ? formData.applicableCategories : undefined,
          applicableProducts: formData.applicableProducts.length > 0 && formData.scope === 'SPECIFIC_ITEMS' ? formData.applicableProducts : undefined,
          notes: formData.notes || undefined,
        });
      }

      if (response.success && response.data) {
        const voucherData = (response.data as { data: Voucher }).data;
        onSuccess(voucherData);
        onClose();
      } else {
        setError(response.error || 'Failed to create voucher');
      }
    } catch (err) {
      setError('An error occurred while creating the voucher');
    }

    setLoading(false);
  }, [formData, onSuccess, onClose]);

  const isStep1Valid = useCallback(() => {
    if (formData.discountType === 'PERCENTAGE') {
      return formData.percentageValue && Number(formData.percentageValue) > 0 && Number(formData.percentageValue) <= 100;
    }
    if (formData.discountType === 'FIXED') {
      return formData.fixedValue && Number(formData.fixedValue) > 0;
    }
    if (formData.discountType === 'FREE_ITEM') {
      return formData.freeItemId;
    }
    return false;
  }, [formData]);

  const isStep2Valid = useCallback(() => {
    if (formData.discountType === 'FREE_ITEM') {
      return formData.expiresAt;
    }
    if (formData.scope === 'SPECIFIC_ITEMS') {
      return formData.applicableCategories.length > 0 || formData.applicableProducts.length > 0;
    }
    return formData.expiresAt;
  }, [formData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-semibold">Create Promotional Voucher</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="flex items-center justify-center gap-4">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 1 ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'
              }`}>1</div>
              <span className="text-sm font-medium">Discount</span>
            </div>
            <div className={`w-12 h-0.5 ${step >= 2 ? 'bg-primary-600' : 'bg-gray-200'}`} />
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 2 ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'
              }`}>2</div>
              <span className="text-sm font-medium">Rules</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-6">
              {/* Discount Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'PERCENTAGE', label: 'Percentage', icon: Percent },
                    { value: 'FIXED', label: 'Fixed Amount', icon: DollarSign },
                    { value: 'FREE_ITEM', label: 'Free Item', icon: Gift },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => handleDiscountTypeChange(value as DiscountType)}
                      className={`p-4 rounded-lg border-2 text-center transition-colors ${
                        formData.discountType === value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className={`h-6 w-6 mx-auto mb-2 ${
                        formData.discountType === value ? 'text-primary-600' : 'text-gray-400'
                      }`} />
                      <span className={`text-sm font-medium ${
                        formData.discountType === value ? 'text-primary-700' : 'text-gray-700'
                      }`}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Percentage Value */}
              {formData.discountType === 'PERCENTAGE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Percentage
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.percentageValue}
                      onChange={(e) => setFormData(prev => ({ ...prev, percentageValue: e.target.value }))}
                      placeholder="20"
                      min={1}
                      max={100}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  </div>
                </div>
              )}

              {/* Fixed Value */}
              {formData.discountType === 'FIXED' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fixed Discount Amount
                  </label>
                  <Input
                    type="number"
                    value={formData.fixedValue}
                    onChange={(e) => setFormData(prev => ({ ...prev, fixedValue: e.target.value }))}
                    placeholder="10000"
                    min={1}
                  />
                </div>
              )}

              {/* Free Item */}
              {formData.discountType === 'FREE_ITEM' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Free Item
                    </label>
                    <select
                      value={formData.freeItemId}
                      onChange={(e) => setFormData(prev => ({ ...prev, freeItemId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select a product</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mode
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, freeItemMode: 'AUTO_ADD' }))}
                        className={`p-3 rounded-lg border-2 text-center transition-colors ${
                          formData.freeItemMode === 'AUTO_ADD'
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className={`text-sm font-medium ${
                          formData.freeItemMode === 'AUTO_ADD' ? 'text-primary-700' : 'text-gray-700'
                        }`}>Auto Add</span>
                        <p className="text-xs text-gray-500 mt-1">Free item added to cart</p>
                      </button>
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, freeItemMode: 'QUALIFY_FIRST' }))}
                        className={`p-3 rounded-lg border-2 text-center transition-colors ${
                          formData.freeItemMode === 'QUALIFY_FIRST'
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className={`text-sm font-medium ${
                          formData.freeItemMode === 'QUALIFY_FIRST' ? 'text-primary-700' : 'text-gray-700'
                        }`}>Qualify First</span>
                        <p className="text-xs text-gray-500 mt-1">Require qualifying item</p>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Scope (not for FREE_ITEM) */}
              {formData.discountType !== 'FREE_ITEM' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Apply To
                  </label>
                  <select
                    value={formData.scope}
                    onChange={(e) => handleScopeChange(e.target.value as Scope)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="ENTIRE_ORDER">Entire Order (Items + Tax)</option>
                    <option value="ITEMS_ONLY">Items Only (Before Tax)</option>
                    <option value="SUBTOTAL">Subtotal (Before Discounts)</option>
                    <option value="SPECIFIC_ITEMS">Specific Items</option>
                  </select>
                </div>
              )}

              {/* Applicable Items (for SPECIFIC_ITEMS scope) */}
              {formData.discountType !== 'FREE_ITEM' && formData.scope === 'SPECIFIC_ITEMS' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Applicable Categories
                    </label>
                    <div className="flex gap-2">
                      <select
                        value=""
                        onChange={(e) => handleAddApplicableCategory(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Select category</option>
                        {categories.filter(c => !formData.applicableCategories.includes(c.id)).map(category => (
                          <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                      </select>
                    </div>
                    {formData.applicableCategories.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.applicableCategories.map(catId => {
                          const category = categories.find(c => c.id === catId);
                          return category && (
                            <span key={catId} className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-sm">
                              {category.name}
                              <button onClick={() => handleRemoveApplicableCategory(catId)}>
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Applicable Products
                    </label>
                    <select
                      value=""
                      onChange={(e) => handleAddApplicableProduct(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select product</option>
                      {products.filter(p => !formData.applicableProducts.includes(p.id)).map(product => (
                        <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>
                      ))}
                    </select>
                    {formData.applicableProducts.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.applicableProducts.map(prodId => {
                          const product = products.find(p => p.id === prodId);
                          return product && (
                            <span key={prodId} className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-sm">
                              {product.name}
                              <button onClick={() => handleRemoveApplicableProduct(prodId)}>
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Qualifier Items (for FREE_ITEM QUALIFY_FIRST) */}
              {formData.discountType === 'FREE_ITEM' && formData.freeItemMode === 'QUALIFY_FIRST' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Customer must add one of these items to use the voucher:
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Qualifying Categories
                    </label>
                    <select
                      value=""
                      onChange={(e) => handleAddQualifierCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select category</option>
                      {categories.filter(c => !formData.qualifierCategories.includes(c.id)).map(category => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                    {formData.qualifierCategories.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.qualifierCategories.map(catId => {
                          const category = categories.find(c => c.id === catId);
                          return category && (
                            <span key={catId} className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                              {category.name}
                              <button onClick={() => handleRemoveQualifierCategory(catId)}>
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Qualifying Products
                    </label>
                    <select
                      value=""
                      onChange={(e) => handleAddQualifierProduct(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select product</option>
                      {products.filter(p => !formData.qualifierProducts.includes(p.id)).map(product => (
                        <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>
                      ))}
                    </select>
                    {formData.qualifierProducts.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.qualifierProducts.map(prodId => {
                          const product = products.find(p => p.id === prodId);
                          return product && (
                            <span key={prodId} className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                              {product.name}
                              <button onClick={() => handleRemoveQualifierProduct(prodId)}>
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {/* Min Purchase */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Purchase (Optional)
                </label>
                <Input
                  type="number"
                  value={formData.minPurchase}
                  onChange={(e) => setFormData(prev => ({ ...prev, minPurchase: e.target.value }))}
                  placeholder="50000"
                  min={0}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimum order subtotal required to use this voucher
                </p>
              </div>

              {/* Max Discount */}
              {formData.discountType !== 'FREE_ITEM' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Maximum Discount Cap (Optional)
                  </label>
                  <Input
                    type="number"
                    value={formData.maxDiscount}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxDiscount: e.target.value }))}
                    placeholder="20000"
                    min={0}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum discount amount (e.g., 20% off with max Rp 20,000)
                  </p>
                </div>
              )}

              {/* Expiration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiration Date *
                </label>
                <Input
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Internal notes about this voucher..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
          
          {step < 2 ? (
            <Button
              className="flex-1"
              onClick={() => setStep(step + 1)}
              disabled={!isStep1Valid()}
            >
              Next
            </Button>
          ) : (
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={!isStep2Valid() || loading}
              isLoading={loading}
            >
              Create Voucher
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
