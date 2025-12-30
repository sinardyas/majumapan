import { useState } from 'react';
import { useToast } from '@pos/ui';
import { dashboardApi } from '@/services/api';

export default function DataManagement() {
  const [isExporting, setIsExporting] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'products' | 'categories' | 'users'>('products');

  const { success, error } = useToast();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await dashboardApi.exportData(
        selectedType,
        selectedStoreId || undefined
      );

      if (response.success && response.data) {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedType}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        success('Success', 'Data exported successfully');
      } else {
        error('Error', response.error || 'Failed to export data');
      }
    } catch {
      error('Error', 'An unexpected error occurred');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Data Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Export data from the system in CSV format
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Export Data
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as any)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="products">Products</option>
                <option value="categories">Categories</option>
                <option value="users">Users</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Choose which type of data to export
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Store (Optional)
              </label>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">All Stores</option>
                <option value="store-1">Store 1</option>
                <option value="store-2">Store 2</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Filter by store, or leave blank for all stores
              </p>
            </div>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? 'Exporting...' : 'Export Data'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Export Information
          </h2>

          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Products Export</h3>
              <p className="text-gray-600 mb-2">
                Includes all product information such as SKU, barcode, name, description,
                price, cost price, category, and active status.
              </p>
              <p className="text-xs text-gray-500">
                Fields: id, storeId, sku, barcode, name, description, price,
                costPrice, categoryId, isActive
              </p>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-900 mb-2">Categories Export</h3>
              <p className="text-gray-600 mb-2">
                Includes all category information such as name, description, and active status.
              </p>
              <p className="text-xs text-gray-500">
                Fields: id, storeId, name, description, isActive
              </p>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-900 mb-2">Users Export</h3>
              <p className="text-gray-600 mb-2">
                Includes all user information such as email, name, role, store assignment,
                and active status.
              </p>
              <p className="text-xs text-gray-500">
                Fields: id, email, name, role, storeId, isActive, createdAt
              </p>
            </div>

            <div className="border-t pt-4 bg-yellow-50 p-3 rounded">
              <p className="text-yellow-800 text-xs">
                <strong>Note:</strong> Exports are provided in CSV format. You can open
                these files in spreadsheet applications like Microsoft Excel, Google Sheets,
                or Apple Numbers.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Data Import
        </h2>

        <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
          <p className="text-blue-800 text-sm">
            <strong>Coming Soon:</strong> Data import functionality will be available in
            a future update. Currently, you can manage data through the individual
            management pages (Stores, Users, Products).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 border rounded">
            <div className="text-3xl mb-2">📦</div>
            <h3 className="font-medium text-gray-900 mb-1">Import Products</h3>
            <p className="text-xs text-gray-500">
              Bulk import products from CSV
            </p>
          </div>

          <div className="text-center p-4 border rounded">
            <div className="text-3xl mb-2">📁</div>
            <h3 className="font-medium text-gray-900 mb-1">Import Categories</h3>
            <p className="text-xs text-gray-500">
              Bulk import categories from CSV
            </p>
          </div>

          <div className="text-center p-4 border rounded">
            <div className="text-3xl mb-2">👥</div>
            <h3 className="font-medium text-gray-900 mb-1">Import Users</h3>
            <p className="text-xs text-gray-500">
              Bulk import users from CSV
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
