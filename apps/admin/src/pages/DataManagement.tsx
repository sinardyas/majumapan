import { useState, useRef } from 'react';
import { dashboardApi, dataApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@pos/ui';
import { Upload, Download, FileSpreadsheet, Package, FolderOpen, Users, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

type DataType = 'products' | 'categories' | 'users';

interface ImportResult {
  success: boolean;
  data?: {
    imported: number;
    errors: number;
    details: {
      success: string[];
      errors: { row: number; error: string }[];
    };
  };
  error?: string;
}

const DATA_TYPE_INFO: Record<DataType, { label: string; icon: React.ReactNode; fields: string[]; description: string }> = {
  products: {
    label: 'Products',
    icon: <Package className="w-5 h-5" />,
    fields: ['id', 'storeId', 'sku', 'barcode', 'name', 'description', 'price', 'costPrice', 'categoryId', 'isActive'],
    description: 'Includes all product information such as SKU, barcode, name, description, price, cost price, category, and active status.',
  },
  categories: {
    label: 'Categories',
    icon: <FolderOpen className="w-5 h-5" />,
    fields: ['id', 'storeId', 'name', 'description', 'isActive'],
    description: 'Includes all category information such as name, description, and active status.',
  },
  users: {
    label: 'Users',
    icon: <Users className="w-5 h-5" />,
    fields: ['id', 'email', 'name', 'role', 'storeId', 'isActive', 'createdAt'],
    description: 'Includes all user information such as email, name, role, store assignment, and active status.',
  },
};

export default function DataManagement() {
  const [exportType, setExportType] = useState<DataType>('products');
  const [exportStoreId, setExportStoreId] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  const [importType, setImportType] = useState<DataType>('products');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await dashboardApi.exportData(
        exportType,
        exportStoreId || undefined
      );

      if (response.success && response.data) {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${exportType}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setImportResult({ success: false, error: 'Please select a CSV file' });
        return;
      }
      setImportFile(file);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const text = await importFile.text();
      const items = parseCSV(text);
      const response = await dataApi.importData(importType, items);

      if (response.success && response.data) {
        setImportResult({
          success: true,
          data: response.data as ImportResult['data'],
        });
        setImportFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setImportResult({
          success: false,
          error: response.error || 'Import failed',
        });
      }
    } catch (err) {
      console.error('Import error:', err);
      setImportResult({
        success: false,
        error: 'An unexpected error occurred',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const clearImport = () => {
    setImportFile(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Data Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Export and import data in CSV format
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Export Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Data Type
                </label>
                <select
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value as DataType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Store (Optional)
                </label>
                <select
                  value={exportStoreId}
                  onChange={(e) => setExportStoreId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Stores</option>
                  <option value="store-1">Store 1</option>
                  <option value="store-2">Store 2</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Filter by store, or leave blank for all stores
                </p>
              </div>

              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export {DATA_TYPE_INFO[exportType].label}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              {Object.entries(DATA_TYPE_INFO).map(([key, info]) => (
                <div key={key}>
                  <h3 className="font-medium text-gray-900 mb-1 flex items-center gap-2">
                    {info.icon}
                    {info.label} Export
                  </h3>
                  <p className="text-gray-600 mb-1">
                    {info.description}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">
                    Fields: {info.fields.join(', ')}
                  </p>
                  {key !== 'users' && <div className="border-t pt-4 mt-4" />}
                </div>
              ))}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <p className="text-yellow-800 text-xs">
                    <strong>Note:</strong> Exports are provided in CSV format. You can open
                    these files in spreadsheet applications like Microsoft Excel, Google Sheets,
                    or Apple Numbers.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex flex-wrap gap-4">
              {Object.entries(DATA_TYPE_INFO).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => {
                    setImportType(key as DataType);
                    clearImport();
                  }}
                  className={`flex-1 min-w-[150px] p-4 rounded-lg border-2 text-center transition-colors ${
                    importType === key
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-center mb-2 text-gray-600">
                    {info.icon}
                  </div>
                  <h3 className="font-medium text-gray-900 text-sm">{info.label}</h3>
                </button>
              ))}
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <div className="text-center">
                <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-2">
                  {importFile ? importFile.name : 'Select a CSV file to import'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                  Choose File
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  Maximum file size: 10MB
                </p>
              </div>
            </div>

            {importFile && (
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">{importFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(importFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={clearImport}>
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            )}

            {importResult && (
              <div className={`rounded-lg p-4 ${
                importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  {importResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h3 className={`font-medium ${importResult.success ? 'text-green-900' : 'text-red-900'}`}>
                      {importResult.success ? 'Import Successful' : 'Import Failed'}
                    </h3>
                    {importResult.success && importResult.data && (
                      <div className="mt-2 text-sm text-green-800">
                        <p>Imported: {importResult.data.imported} records</p>
                        <p>Errors: {importResult.data.errors} records</p>
                      </div>
                    )}
                    {importResult.error && (
                      <p className="mt-2 text-sm text-red-800">{importResult.error}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={handleImport}
              disabled={!importFile || isImporting}
              className="w-full"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import {DATA_TYPE_INFO[importType].label}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function parseCSV(text: string): Record<string, unknown>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const items: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const item: Record<string, unknown> = {};

    headers.forEach((header, index) => {
      const value = values[index];
      if (value === undefined || value === '') {
        item[header] = null;
      } else if (!isNaN(Number(value))) {
        item[header] = Number(value);
      } else if (value.toLowerCase() === 'true') {
        item[header] = true;
      } else if (value.toLowerCase() === 'false') {
        item[header] = false;
      } else {
        item[header] = value;
      }
    });

    items.push(item);
  }

  return items;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
