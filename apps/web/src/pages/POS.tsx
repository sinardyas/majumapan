import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore, type CartDiscount } from '@/stores/cartStore';
import { 
  db, 
  type LocalProduct, 
  type LocalTransaction,
  getHeldOrdersCount,
  deleteExpiredHeldOrders,
  deleteHeldOrder,
} from '@/db';
import { Button } from '@pos/ui';
import { useToast } from '@pos/ui';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useBarcode } from '@/hooks/useBarcode';
import { PaymentModal } from '@/components/pos/PaymentModal';
import { Receipt } from '@/components/pos/Receipt';
import { HoldOrderModal } from '@/components/pos/HoldOrderModal';
import { HeldOrdersList } from '@/components/pos/HeldOrdersList';
import { ResumeConfirmModal } from '@/components/pos/ResumeConfirmModal';
import type { PaymentMethod } from '@pos/shared';

export default function POS() {
  const { user } = useAuthStore();
  const { 
    items, 
    subtotal, 
    discountAmount, 
    taxAmount, 
    total, 
    cartDiscount,
    addItem, 
    updateItemQuantity, 
    removeItem, 
    clearCart,
    applyDiscount,
    removeDiscount,
    holdOrder,
    resumeOrder,
    resumedOrderInfo,
  } = useCartStore();
  const { isOnline } = useOnlineStatus();
  const toast = useToast();
  
  const [products, setProducts] = useState<(LocalProduct & { stockQuantity: number })[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Discount code state
  const [discountCode, setDiscountCode] = useState('');
  const [discountError, setDiscountError] = useState('');
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Receipt state
  const [completedTransaction, setCompletedTransaction] = useState<LocalTransaction | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState<string | null>(null);
  const [storePhone, setStorePhone] = useState<string | null>(null);
  
  // Hold Order state
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showHeldOrdersList, setShowHeldOrdersList] = useState(false);
  const [showResumeConfirm, setShowResumeConfirm] = useState(false);
  const [heldOrdersCount, setHeldOrdersCount] = useState(0);
  const [pendingResumeOrderId, setPendingResumeOrderId] = useState<string | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  
  const receiptRef = useRef<HTMLDivElement>(null);

  // Barcode scanner handler
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    if (!user?.storeId) return;
    
    // Find product by barcode
    const product = await db.products
      .where('barcode')
      .equals(barcode)
      .filter(p => p.storeId === user.storeId && p.isActive === true)
      .first();
    
    if (product) {
      const stockRecord = await db.stock
        .where('[storeId+productId]')
        .equals([user.storeId, product.id])
        .first();
      
      const stockQuantity = stockRecord?.quantity ?? 0;
      
      if (stockQuantity <= 0) {
        // Could show a toast notification here
        console.warn('Product out of stock:', product.name);
        return;
      }
      
      addItem({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        quantity: 1,
        unitPrice: product.price,
        discountValue: 0,
      });
    } else {
      console.warn('Product not found for barcode:', barcode);
    }
  }, [user?.storeId, addItem]);

  // Initialize barcode scanner
  useBarcode({ onScan: handleBarcodeScan });

  // Load products from IndexedDB
  useEffect(() => {
    const loadData = async () => {
      if (!user?.storeId) {
        setIsLoading(false);
        return;
      }

      try {
	console.log('>>>>> user.storeId ', user.storeId);
        // Load store info
        const store = await db.store.get(user.storeId);


	console.log('>>>>> store ', store);

        if (store) {
          setStoreName(store.name);
          setStoreAddress(store.address);
          setStorePhone(store.phone);
        }

        // Load categories
        const localCategories = await db.categories
          .where('storeId')
          .equals(user.storeId)
          .filter(c => c.isActive === true)
          .toArray();
	console.log('localCategories', localCategories);

        setCategories(localCategories.map(c => ({ id: c.id, name: c.name })));

        // Load products with stock
        const localProducts = await db.products
          .where('storeId')
          .equals(user.storeId)
          .filter(p => p.isActive === true)
          .toArray();

	console.log('localProducts', localProducts);

        const productsWithStock = await Promise.all(
          localProducts.map(async (product) => {
            const stockRecord = await db.stock
              .where('[storeId+productId]')
              .equals([user.storeId!, product.id])
              .first();
            return {
              ...product,
              stockQuantity: stockRecord?.quantity ?? 0,
            };
          })
        );
	console.log('productsWithStock', productsWithStock);

        setProducts(productsWithStock);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user?.storeId]);

  // Initialize held orders: cleanup expired and load count
  useEffect(() => {
    const initHeldOrders = async () => {
      if (!user?.storeId || !user?.id) return;
      
      try {
        // Clean up expired orders
        const expiredCount = await deleteExpiredHeldOrders();
        if (expiredCount > 0) {
          console.log(`Cleaned up ${expiredCount} expired held orders`);
        }
        
        // Load count
        const count = await getHeldOrdersCount(user.storeId, user.id);
        setHeldOrdersCount(count);
      } catch (error) {
        console.error('Error initializing held orders:', error);
      }
    };
    
    initHeldOrders();
  }, [user?.storeId, user?.id]);

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
    const matchesSearch = !searchQuery ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleProductClick = (product: LocalProduct & { stockQuantity: number }) => {
    if (product.stockQuantity <= 0) return;

    addItem({
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      quantity: 1,
      unitPrice: product.price,
      discountValue: 0,
    });
  };

  const handleApplyDiscount = async () => {
    if (!discountCode.trim() || !user?.storeId) return;
    
    setIsApplyingDiscount(true);
    setDiscountError('');
    
    try {
      // Search for discount by code in local DB
      const discount = await db.discounts
        .where('code')
        .equals(discountCode.toUpperCase())
        .filter(d => d.isActive === true)
        .first();
      
      if (!discount) {
        setDiscountError('Invalid discount code');
        return;
      }
      
      // Check if discount is for cart scope
      if (discount.discountScope !== 'cart') {
        setDiscountError('This discount can only be applied to specific products');
        return;
      }
      
      // Check store restriction
      if (discount.storeId && discount.storeId !== user.storeId) {
        setDiscountError('This discount is not valid for this store');
        return;
      }
      
      // Check date validity
      const now = new Date();
      if (discount.startDate && new Date(discount.startDate) > now) {
        setDiscountError('This discount is not yet active');
        return;
      }
      if (discount.endDate && new Date(discount.endDate) < now) {
        setDiscountError('This discount has expired');
        return;
      }
      
      // Check minimum purchase
      const minPurchase = Number(discount.minPurchaseAmount);
      if (minPurchase && subtotal < minPurchase) {
        setDiscountError(`Minimum purchase of $${minPurchase.toFixed(2)} required`);
        return;
      }
      
      // Check usage limit
      if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
        setDiscountError('This discount has reached its usage limit');
        return;
      }
      
      // Calculate discount amount
      const discountValueNum = Number(discount.value);
      let discountValue = 0;
      if (discount.discountType === 'percentage') {
        discountValue = (subtotal * discountValueNum) / 100;
      } else {
        discountValue = discountValueNum;
      }
      
      // Apply max discount cap
      const maxDiscount = Number(discount.maxDiscountAmount);
      if (maxDiscount && discountValue > maxDiscount) {
        discountValue = maxDiscount;
      }
      
      // Apply discount
      applyDiscount({
        id: discount.id,
        code: discount.code || '',
        name: discount.name,
        discountType: discount.discountType,
        value: discount.value,
        amount: discountValue,
      });
      
      setDiscountCode('');
    } catch (error) {
      console.error('Error applying discount:', error);
      setDiscountError('Failed to apply discount');
    } finally {
      setIsApplyingDiscount(false);
    }
  };

  // ============================================================================
  // Hold Order Handlers
  // ============================================================================

  const revalidateDiscount = async (discount: CartDiscount): Promise<boolean> => {
    try {
      const dbDiscount = await db.discounts.get(discount.id);
      
      if (!dbDiscount || !dbDiscount.isActive) return false;
      
      const now = new Date();
      if (dbDiscount.startDate && new Date(dbDiscount.startDate) > now) return false;
      if (dbDiscount.endDate && new Date(dbDiscount.endDate) < now) return false;
      if (dbDiscount.usageLimit && dbDiscount.usageCount >= dbDiscount.usageLimit) return false;
      
      return true;
    } catch {
      return false;
    }
  };

  const handleHoldOrder = async (customerName?: string, note?: string) => {
    if (!user?.storeId || !user?.id) return;
    
    setIsHolding(true);
    try {
      await holdOrder(user.storeId, user.id, customerName, note);
      setHeldOrdersCount(prev => prev + 1);
      setShowHoldModal(false);
      toast.success('Order held successfully');
    } catch (error) {
      console.error('Error holding order:', error);
      toast.error('Failed to hold order');
    } finally {
      setIsHolding(false);
    }
  };

  const executeResume = async (heldOrderId: string) => {
    try {
      const result = await resumeOrder(heldOrderId, revalidateDiscount);
      
      if (!result.success) {
        toast.error(result.error || 'Failed to resume order');
        return;
      }
      
      // Update count
      setHeldOrdersCount(prev => Math.max(0, prev - 1));
      setShowHeldOrdersList(false);
      setShowResumeConfirm(false);
      setPendingResumeOrderId(null);
      
      toast.success('Order resumed');
      
      // Show warning if discount was removed
      if (result.discountRemoved && result.discountName) {
        toast.warning(
          `Discount '${result.discountName}' is no longer valid and was removed`
        );
      }
    } catch (error) {
      console.error('Error resuming order:', error);
      toast.error('Failed to resume order');
    }
  };

  const handleResumeOrder = async (heldOrderId: string) => {
    // If cart has items, show confirmation first
    if (items.length > 0) {
      setPendingResumeOrderId(heldOrderId);
      setShowResumeConfirm(true);
      return;
    }
    
    // Otherwise, resume directly
    await executeResume(heldOrderId);
  };

  const handleConfirmResume = async () => {
    if (pendingResumeOrderId) {
      await executeResume(pendingResumeOrderId);
    }
  };

  const handleDeleteHeldOrder = async (heldOrderId: string) => {
    try {
      await deleteHeldOrder(heldOrderId);
      setHeldOrdersCount(prev => Math.max(0, prev - 1));
      toast.success('Held order deleted');
    } catch (error) {
      console.error('Error deleting held order:', error);
      toast.error('Failed to delete held order');
    }
  };

  const generateTransactionNumber = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const sequence = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `TXN-${dateStr}-${sequence}`;
  };

  const handlePaymentConfirm = async (paymentMethod: PaymentMethod, amountPaid: number) => {
    if (!user?.storeId || !user?.id) return;
    
    const changeAmount = paymentMethod === 'cash' ? Math.max(0, amountPaid - total) : 0;
    const now = new Date().toISOString();
    const clientId = crypto.randomUUID();
    
    const transaction: LocalTransaction = {
      clientId,
      storeId: user.storeId,
      cashierId: user.id,
      transactionNumber: generateTransactionNumber(),
      items: items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountId: item.discountId,
        discountName: item.discountName,
        discountValue: item.discountValue,
        subtotal: item.subtotal,
      })),
      subtotal,
      taxAmount,
      discountAmount,
      discountId: cartDiscount?.id,
      discountCode: cartDiscount?.code,
      discountName: cartDiscount?.name,
      total,
      paymentMethod,
      amountPaid,
      changeAmount,
      status: 'completed',
      syncStatus: isOnline ? 'pending' : 'pending',
      clientTimestamp: now,
      createdAt: now,
    };
    
    try {
      // Save transaction to IndexedDB
      await db.transactions.add(transaction);
      
      // Update local stock
      for (const item of items) {
        const stockRecord = await db.stock
          .where({ productId: item.productId, storeId: user.storeId })
          .first();
        
        if (stockRecord) {
          await db.stock.update(stockRecord.id, {
            quantity: Math.max(0, stockRecord.quantity - item.quantity),
            updatedAt: now,
          });
        }
      }
      
      // Update products in state with new stock
      setProducts(prev => prev.map(p => {
        const cartItem = items.find(i => i.productId === p.id);
        if (cartItem) {
          return {
            ...p,
            stockQuantity: Math.max(0, p.stockQuantity - cartItem.quantity),
          };
        }
        return p;
      }));
      
      // Set completed transaction for receipt
      setCompletedTransaction(transaction);
      setShowReceipt(true);
      
      // Close payment modal
      setShowPaymentModal(false);
      
      // Clear cart
      clearCart();
    } catch (error) {
      console.error('Error saving transaction:', error);
      // Could show error toast here
    }
  };

  const handlePrint = () => {
    if (!receiptRef.current) return;
    
    const printContent = receiptRef.current.innerHTML;
    const printWindow = window.open('', '', 'width=302,height=600');
    
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt</title>
            <style>
              body {
                font-family: monospace;
                font-size: 12px;
                line-height: 1.4;
                padding: 10px;
                margin: 0;
                width: 80mm;
              }
              table { width: 100%; border-collapse: collapse; }
              th, td { padding: 2px 0; }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .text-left { text-align: left; }
              .font-bold { font-weight: bold; }
              .text-lg { font-size: 14px; }
              .text-xs { font-size: 10px; }
              .uppercase { text-transform: uppercase; }
              .border-t { border-top: 1px dashed #666; }
              .border-b { border-bottom: 1px dashed #666; }
              .my-2 { margin: 8px 0; }
              .mb-4 { margin-bottom: 16px; }
              .mt-4 { margin-top: 16px; }
              .py-1 { padding: 4px 0; }
              .pt-1 { padding-top: 4px; }
              .pb-1 { padding-bottom: 4px; }
              .text-gray-500 { color: #666; }
              .text-gray-600 { color: #555; }
              .text-green-600 { color: #16a34a; }
              .text-yellow-600 { color: #ca8a04; }
              .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
              .flex { display: flex; }
              .justify-between { justify-content: space-between; }
              .space-y-1 > * + * { margin-top: 4px; }
              @media print {
                body { width: 80mm; }
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  const handleCloseReceipt = () => {
    setShowReceipt(false);
    setCompletedTransaction(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  // Show message for admin users without a store assigned
  if (!user?.storeId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center px-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 max-w-md">
          <svg className="h-16 w-16 text-amber-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Store Assigned</h2>
          <p className="text-gray-600 mb-4">
            Your admin account is not assigned to a specific store. 
            Please use the store selector feature (coming soon) or contact the system administrator.
          </p>
          <p className="text-sm text-amber-600">
            Tip: Login with a manager or cashier account to access store data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Products Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search products or scan barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
                autoFocus
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Online status indicator */}
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
              isOnline ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              <span className={`h-2 w-2 rounded-full ${
                isOnline ? 'bg-green-500' : 'bg-yellow-500'
              }`}></span>
              {isOnline ? 'Online' : 'Offline'}
            </div>
          </div>

          {/* Categories */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                !selectedCategory
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </header>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No products found</p>
              {!isOnline && (
                <p className="text-sm mt-2">Sync data when online to load products</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  disabled={product.stockQuantity <= 0}
                  className={`bg-white rounded-xl p-4 text-left transition-all ${
                    product.stockQuantity <= 0
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:shadow-md hover:scale-105 cursor-pointer'
                  }`}
                >
                  {/* Product Image Placeholder */}
                  <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                    {product.imageBase64 ? (
                      <img
                        src={product.imageBase64}
                        alt={product.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    )}
                  </div>
                  <h3 className="font-medium text-gray-900 truncate">{product.name}</h3>
                  <p className="text-sm text-gray-500">{product.sku}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-primary-600">
                      {formatCurrency(product.price)}
                    </span>
                    <span className={`text-xs ${
                      product.stockQuantity <= 10 ? 'text-red-500' : 'text-gray-500'
                    }`}>
                      Stock: {product.stockQuantity}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
        {/* Cart Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Current Order</h2>
            {resumedOrderInfo && (
              <p className="text-sm text-primary-600 mt-1">
                Resumed: {resumedOrderInfo.customerName || 'Held Order'}
              </p>
            )}
          </div>
          {/* Held Orders Button */}
          <button
            onClick={() => setShowHeldOrdersList(true)}
            className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Held Orders"
          >
            <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {heldOrdersCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                {heldOrdersCount}
              </span>
            )}
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg
                className="h-16 w-16 mx-auto text-gray-300 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p>Cart is empty</p>
              <p className="text-sm mt-1">Add products to get started</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.productId} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">
                        {item.productName}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(item.unitPrice)} each
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateItemQuantity(item.productId, item.quantity - 1)}
                        className="h-8 w-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateItemQuantity(item.productId, item.quantity + 1)}
                        className="h-8 w-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-semibold">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Discount Code Section */}
        {items.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200">
            {cartDiscount ? (
              <div className="flex items-center justify-between bg-green-50 rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium text-green-700">
                    {cartDiscount.name}
                  </p>
                  <p className="text-xs text-green-600">
                    {cartDiscount.discountType === 'percentage' 
                      ? `${cartDiscount.value}% off`
                      : `${formatCurrency(cartDiscount.value)} off`
                    }
                  </p>
                </div>
                <button
                  onClick={removeDiscount}
                  className="text-green-700 hover:text-green-800 p-1"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Discount code"
                    value={discountCode}
                    onChange={(e) => {
                      setDiscountCode(e.target.value.toUpperCase());
                      setDiscountError('');
                    }}
                    className="input flex-1 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyDiscount();
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleApplyDiscount}
                    disabled={isApplyingDiscount || !discountCode.trim()}
                  >
                    {isApplyingDiscount ? '...' : 'Apply'}
                  </Button>
                </div>
                {discountError && (
                  <p className="text-red-500 text-xs mt-1">{discountError}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cart Summary & Checkout */}
        <div className="border-t border-gray-200 p-4 space-y-4">
          {/* Summary */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Tax (10%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              className="w-full"
              size="lg"
              disabled={items.length === 0}
              onClick={() => setShowPaymentModal(true)}
            >
              Pay {formatCurrency(total)}
            </Button>
            
            {/* Hold Order and Clear Cart buttons side by side */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowHoldModal(true)}
                disabled={items.length === 0}
              >
                Hold Order
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={clearCart}
                disabled={items.length === 0}
              >
                Clear Cart
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={handlePaymentConfirm}
        total={total}
      />

      {/* Receipt Modal */}
      {showReceipt && completedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={handleCloseReceipt}
          />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Transaction Complete</h2>
              <button 
                onClick={handleCloseReceipt}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Receipt Preview */}
            <div className="max-h-[60vh] overflow-y-auto">
              <Receipt
                ref={receiptRef}
                transaction={completedTransaction}
                storeName={storeName || 'Store'}
                storeAddress={storeAddress}
                storePhone={storePhone}
                cashierName={user?.name || 'Cashier'}
              />
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCloseReceipt}
              >
                Close
              </Button>
              <Button
                className="flex-1"
                onClick={handlePrint}
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Receipt
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hold Order Modal */}
      <HoldOrderModal
        isOpen={showHoldModal}
        onClose={() => setShowHoldModal(false)}
        onHold={handleHoldOrder}
        isLoading={isHolding}
      />

      {/* Held Orders List Modal */}
      <HeldOrdersList
        isOpen={showHeldOrdersList}
        onClose={() => setShowHeldOrdersList(false)}
        onResume={handleResumeOrder}
        onDelete={handleDeleteHeldOrder}
        storeId={user?.storeId || ''}
        cashierId={user?.id || ''}
      />

      {/* Resume Confirm Modal */}
      <ResumeConfirmModal
        isOpen={showResumeConfirm}
        onClose={() => {
          setShowResumeConfirm(false);
          setPendingResumeOrderId(null);
        }}
        onConfirm={handleConfirmResume}
        currentCartItemCount={items.length}
        currentCartTotal={total}
      />
    </div>
  );
}
