import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore, type CartDiscount } from '@/stores/cartStore';
import { useShiftStore } from '@/stores/shiftStore';
import { 
  db, 
  type LocalProduct, 
  type LocalTransaction,
  type LocalPayment,
  getHeldOrdersCount,
  deleteExpiredHeldOrders,
  deleteHeldOrder,
} from '@/db';
import { useToast } from '@pos/ui';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useBarcode } from '@/hooks/useBarcode';
import { PaymentModal } from '@/components/pos/PaymentModal';
import { Receipt } from '@/components/pos/Receipt';
import { HoldOrderModal } from '@/components/pos/HoldOrderModal';
import { HeldOrdersList } from '@/components/pos/HeldOrdersList';
import { ResumeConfirmModal } from '@/components/pos/ResumeConfirmModal';
import { ShiftModal } from '@/components/shift/ShiftModal';
import { POSHeader } from '@/components/pos/POSHeader';
import { POSSearchBar } from '@/components/pos/POSSearchBar';
import { CategoriesBar } from '@/components/pos/CategoriesBar';
import { CartSidebar } from '@/components/pos/CartSidebar';
import { CartView } from '@/components/pos/CartView';
import { CurrentOrder } from '@/components/pos/CurrentOrder';
import type { PaymentMethod } from '@pos/shared';
import { 
  X, Printer, AlertTriangle, Box 
} from 'lucide-react';

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
  } = useCartStore();
  const { activeShift, loadActiveShift, status } = useShiftStore();
  const { isOnline } = useOnlineStatus();
  const toast = useToast();
  
  const [products, setProducts] = useState<(LocalProduct & { stockQuantity: number })[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'cart'>('grid');
  const [skuSearchQuery, setSkuSearchQuery] = useState('');
  const [skuSearchOpen, setSkuSearchOpen] = useState(false);
  const [popoverSelectedIndex, setPopoverSelectedIndex] = useState(0);
  const skuInputRef = useRef<HTMLInputElement>(null);
  
  const [discountCode, setDiscountCode] = useState('');
  const [discountError, setDiscountError] = useState('');
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<LocalTransaction | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState<string | null>(null);
  const [storePhone, setStorePhone] = useState<string | null>(null);
  
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showHeldOrdersList, setShowHeldOrdersList] = useState(false);
  const [showResumeConfirm, setShowResumeConfirm] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showShiftMessage, setShowShiftMessage] = useState(false);
  const [heldOrdersCount, setHeldOrdersCount] = useState(0);
  const [pendingResumeOrderId, setPendingResumeOrderId] = useState<string | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  
  const receiptRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const isPromoActive = (product: LocalProduct): boolean => {
    if (!product.hasPromo) return false;
    const now = new Date();
    if (product.promoStartDate && new Date(product.promoStartDate) > now) return false;
    if (product.promoEndDate && new Date(product.promoEndDate) < now) return false;
    return true;
  };

  const getPromoLabel = (product: LocalProduct): string | null => {
    if (!isPromoActive(product) || !product.promoType || !product.promoValue) {
      return null;
    }
    return product.promoType === 'percentage'
      ? `${product.promoValue}% OFF`
      : `${formatCurrency(product.promoValue)} OFF`;
  };

  const checkExpiredPromos = useCallback(async () => {
    const cartItems = useCartStore.getState().items;
    if (cartItems.length === 0) return;

    const expiredPromoProducts: string[] = [];

    for (const item of cartItems) {
      if (!item.promoType) continue;

      const product = await db.products.get(item.productId);
      if (!product) continue;

      const promoWasActive = product.hasPromo && 
        product.promoType === item.promoType &&
        product.promoValue === item.promoValue &&
        product.promoMinQty === item.promoMinQty;

      const promoIsNowInactive = !isPromoActive(product);

      if (promoWasActive && promoIsNowInactive) {
        expiredPromoProducts.push(item.productName);
      }
    }

    if (expiredPromoProducts.length > 0) {
      const productList = expiredPromoProducts.slice(0, 3).join(', ');
      const moreText = expiredPromoProducts.length > 3 
        ? ` and ${expiredPromoProducts.length - 3} more` 
        : '';
      toast.warning(
        `Promo expired for: ${productList}${moreText}. Prices have been recalculated.`
      );
    }
  }, [toast]);

  const handleBarcodeScan = useCallback(async (barcode: string) => {
    if (!user?.storeId) return;
    
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
        console.warn('Product out of stock:', product.name);
        return;
      }
      
      const hasActivePromo = isPromoActive(product);
      
      addItem({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        quantity: 1,
        unitPrice: product.price,
        discountValue: 0,
        promoType: hasActivePromo ? product.promoType ?? undefined : undefined,
        promoValue: hasActivePromo ? product.promoValue ?? undefined : undefined,
        promoMinQty: hasActivePromo ? product.promoMinQty : undefined,
      });
    } else {
      console.warn('Product not found for barcode:', barcode);
    }
  }, [user?.storeId, addItem]);

  useBarcode({ onScan: handleBarcodeScan });

  useEffect(() => {
    const loadData = async () => {
      if (!user?.storeId) {
        setIsLoading(false);
        return;
      }

      try {
        const store = await db.store.get(user.storeId);

        if (store) {
          setStoreName(store.name);
          setStoreAddress(store.address);
          setStorePhone(store.phone);
        }

        const localCategories = await db.categories
          .where('storeId')
          .equals(user.storeId)
          .filter(c => c.isActive === true)
          .toArray();

        setCategories(localCategories.map(c => ({ id: c.id, name: c.name })));

        const localProducts = await db.products
          .where('storeId')
          .equals(user.storeId)
          .filter(p => p.isActive === true)
          .toArray();

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

        setProducts(productsWithStock);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user?.storeId]);

  useEffect(() => {
    if (!isLoading && products.length > 0) {
      checkExpiredPromos();
    }
  }, [isLoading, products.length, checkExpiredPromos]);

  useEffect(() => {
    const initHeldOrders = async () => {
      if (!user?.storeId || !user?.id) return;
      
      try {
        const expiredCount = await deleteExpiredHeldOrders();
        if (expiredCount > 0) {
          console.log(`Cleaned up ${expiredCount} expired held orders`);
        }
        
        const count = await getHeldOrdersCount(user.storeId, user.id);
        setHeldOrdersCount(count);
      } catch (error) {
        console.error('Error initializing held orders:', error);
      }
    };
    
    initHeldOrders();
  }, [user?.storeId, user?.id]);

  useEffect(() => {
    loadActiveShift();
  }, [loadActiveShift]);

  useEffect(() => {
    if (status === 'none' && !activeShift) {
      setShowShiftMessage(true);
    } else {
      setShowShiftMessage(false);
    }
  }, [status, activeShift]);

  useEffect(() => {
    const saved = localStorage.getItem('pos-view-mode') as 'grid' | 'list';
    if (saved) {
      setViewMode(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pos-view-mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setViewMode(prev => {
          switch (prev) {
            case 'grid': return 'list';
            case 'list': return 'cart';
            case 'cart': return 'grid';
          }
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (viewMode === 'list' || viewMode === 'cart') {
      skuInputRef.current?.focus();
    }
  }, [viewMode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (skuSearchQuery.trim()) {
        setSkuSearchOpen(true);
      } else {
        setSkuSearchOpen(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [skuSearchQuery]);

  const skuSearchResults = useMemo(() => {
    if (!skuSearchQuery.trim()) return [];
    const query = skuSearchQuery.toLowerCase();
    return products
      .filter(product =>
        product.sku.toLowerCase().includes(query) ||
        product.barcode?.toLowerCase().includes(query) ||
        product.name.toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [skuSearchQuery, products]);

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

    const hasActivePromo = isPromoActive(product);

    addItem({
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      quantity: 1,
      unitPrice: product.price,
      discountValue: 0,
      promoType: hasActivePromo ? product.promoType ?? undefined : undefined,
      promoValue: hasActivePromo ? product.promoValue ?? undefined : undefined,
      promoMinQty: hasActivePromo ? product.promoMinQty : undefined,
    });
  };

  const handlePopoverKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setPopoverSelectedIndex(prev => Math.max(0, prev - 1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setPopoverSelectedIndex(prev =>
          Math.min(skuSearchResults.length - 1, prev + 1)
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (skuSearchResults[popoverSelectedIndex]) {
          handleProductClick(skuSearchResults[popoverSelectedIndex]);
          setSkuSearchOpen(false);
          setSkuSearchQuery('');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setSkuSearchOpen(false);
        skuInputRef.current?.focus();
        break;
    }
  };

  const handleApplyDiscount = async (code?: string) => {
    const codeToUse = code ?? discountCode;
    if (!codeToUse.trim() || !user?.storeId) return;
    
    setIsApplyingDiscount(true);
    setDiscountError('');
    
    try {
      const discount = await db.discounts
        .where('code')
        .equals(codeToUse.toUpperCase())
        .filter(d => d.isActive === true)
        .first();
      
      if (!discount) {
        setDiscountError('Invalid discount code');
        return;
      }
      
      if (discount.discountScope !== 'cart') {
        setDiscountError('This discount can only be applied to specific products');
        return;
      }
      
      if (discount.storeId && discount.storeId !== user.storeId) {
        setDiscountError('This discount is not valid for this store');
        return;
      }
      
      const now = new Date();
      if (discount.startDate && new Date(discount.startDate) > now) {
        setDiscountError('This discount is not yet active');
        return;
      }
      if (discount.endDate && new Date(discount.endDate) < now) {
        setDiscountError('This discount has expired');
        return;
      }
      
      const minPurchase = Number(discount.minPurchaseAmount);
      if (minPurchase && subtotal < minPurchase) {
        setDiscountError(`Minimum purchase of $${minPurchase.toFixed(2)} required`);
        return;
      }
      
      if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
        setDiscountError('This discount has reached its usage limit');
        return;
      }
      
      const discountValueNum = Number(discount.value);
      let discountValue = 0;
      if (discount.discountType === 'percentage') {
        discountValue = (subtotal * discountValueNum) / 100;
      } else {
        discountValue = discountValueNum;
      }
      
      const maxDiscount = Number(discount.maxDiscountAmount);
      if (maxDiscount && discountValue > maxDiscount) {
        discountValue = maxDiscount;
      }
      
      applyDiscount({
        id: discount.id,
        code: discount.code || '',
        name: discount.name,
        discountType: discount.discountType,
        value: discount.value,
        amount: discountValue,
      });
      
      if (!code) {
        setDiscountCode('');
      }
    } catch (error) {
      console.error('Error applying discount:', error);
      setDiscountError('Failed to apply discount');
    } finally {
      setIsApplyingDiscount(false);
    }
  };

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
      
      setHeldOrdersCount(prev => Math.max(0, prev - 1));
      setShowHeldOrdersList(false);
      setShowResumeConfirm(false);
      setPendingResumeOrderId(null);
      
      toast.success('Order resumed');
      
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
    if (items.length > 0) {
      setPendingResumeOrderId(heldOrderId);
      setShowResumeConfirm(true);
      return;
    }
    
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

  const handlePaymentConfirm = async (
    paymentMethod: PaymentMethod, 
    amountPaid: number, 
    isSplitPayment: boolean = false,
    payments?: LocalPayment[]
  ) => {
    if (!user?.storeId || !user?.id) return;
    
    const now = new Date().toISOString();
    const clientId = crypto.randomUUID();
    
    // For split payments, calculate change from cash only
    let changeAmount = 0;
    if (isSplitPayment && payments) {
      const cashPayment = payments.find(p => p.paymentMethod === 'cash');
      if (cashPayment) {
        const cashAmountApplied = cashPayment.amount - cashPayment.changeAmount;
        changeAmount = cashPayment.amount - cashAmountApplied;
      }
    } else {
      changeAmount = paymentMethod === 'cash' ? Math.max(0, amountPaid - total) : 0;
    }
    
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
        promoType: item.promoType,
        promoValue: item.promoValue,
        promoDiscount: item.promoDiscount,
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
      isSplitPayment,
      paymentMethod: isSplitPayment ? undefined : paymentMethod,
      amountPaid: isSplitPayment ? undefined : amountPaid,
      changeAmount: isSplitPayment ? undefined : changeAmount,
      payments: isSplitPayment ? payments : undefined,
      status: 'completed',
      syncStatus: isOnline ? 'pending' : 'pending',
      clientTimestamp: now,
      createdAt: now,
    };
    
    try {
      await db.transactions.add(transaction);
      
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
      
      setCompletedTransaction(transaction);
      setShowReceipt(true);
      setShowPaymentModal(false);
      clearCart();
    } catch (error) {
      console.error('Error saving transaction:', error);
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

  const handleShiftButtonClick = () => {
    setShowShiftModal(true);
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

  if (!user?.storeId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center px-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 max-w-md">
          <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
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
    <div className="h-screen flex flex-col">
      <POSHeader
        viewMode={viewMode}
        setViewMode={setViewMode}
        isOnline={isOnline}
        activeShift={activeShift}
        onOpenShiftModal={handleShiftButtonClick}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {!showShiftMessage && viewMode !== 'cart' && (
            <POSSearchBar
              viewMode={viewMode}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              skuSearchQuery={skuSearchQuery}
              setSkuSearchQuery={setSkuSearchQuery}
              skuInputRef={skuInputRef}
              handlePopoverKeyDown={handlePopoverKeyDown}
              skuSearchOpen={skuSearchOpen}
              setSkuSearchOpen={setSkuSearchOpen}
              skuSearchResults={skuSearchResults}
              popoverSelectedIndex={popoverSelectedIndex}
              setPopoverSelectedIndex={setPopoverSelectedIndex}
              onProductSelect={handleProductClick}
            />
          )}

          {!showShiftMessage && viewMode !== 'cart' && (
            <CategoriesBar
              categories={categories}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
            />
          )}

          <div className="flex-1 min-h-0">
            {showShiftMessage && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50/95">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Open a shift to start</h2>
                  <p className="text-gray-600 mb-4">Click the calendar icon in the header to open your shift</p>
                  <button
                    onClick={() => setShowShiftModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Open Shift
                  </button>
                </div>
              </div>
            )}
            {viewMode === 'cart' ? (
              <CartView
                items={items}
                onUpdateQuantity={updateItemQuantity}
                onRemoveItem={removeItem}
                skuSearchQuery={skuSearchQuery}
                setSkuSearchQuery={setSkuSearchQuery}
                skuSearchOpen={skuSearchOpen}
                setSkuSearchOpen={setSkuSearchOpen}
                skuSearchResults={skuSearchResults}
                popoverSelectedIndex={popoverSelectedIndex}
                setPopoverSelectedIndex={setPopoverSelectedIndex}
                onProductSelect={handleProductClick}
                skuInputRef={skuInputRef}
              />
            ) : (
              <div className="h-full overflow-y-auto p-6">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>No products found</p>
                    {!isOnline && (
                      <p className="text-sm mt-2">Sync data when online to load products</p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-4">
                    {filteredProducts.map((product) => {
                      const promoLabel = getPromoLabel(product);
                      const stockClass = product.stockQuantity <= 10 ? 'text-red-500' : 'text-gray-500';
                      const buttonClass = product.stockQuantity <= 0 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:shadow-md hover:scale-105 cursor-pointer';
                      
                      return (
                        <button
                          key={product.id}
                          onClick={() => handleProductClick(product)}
                          disabled={product.stockQuantity <= 0}
                          className={`bg-white rounded-xl p-4 text-left transition-all ${buttonClass}`}
                        >
                          <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center relative">
                            {product.imageBase64 ? (
                              <img
                                src={product.imageBase64}
                                alt={product.name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <Box className="h-12 w-12 text-gray-400" />
                            )}
                            {promoLabel && (
                              <span className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                                {promoLabel}
                              </span>
                            )}
                          </div>
                          <h3 className="font-medium text-gray-900 truncate">{product.name}</h3>
                          <p className="text-xs text-gray-500">{product.sku}</p>
                          <div className="mt-1">
                            {promoLabel ? (
                              <div className="flex items-center flex-nowrap">
                                <span className="text-sm text-gray-400 line-through min-w-0 truncate">
                                  {formatCurrency(product.price)}
                                </span>
                                <span className="text-gray-400 mx-0.5 flex-shrink-0">→</span>
                                <span className="text-sm font-bold text-primary-600 flex-shrink-0">
                                  {formatCurrency(product.price * (1 - (product.promoValue ?? 0) / 100))}
                                </span>
                              </div>
                            ) : (
                              <span className="font-bold text-primary-600">
                                {formatCurrency(product.price)}
                              </span>
                            )}
                            <p className={`text-xs mt-1 ${stockClass}`}>
                              Stock: {product.stockQuantity}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {viewMode !== 'cart' ? (
          <CartSidebar
            cashierName={user?.name}
            items={items}
            subtotal={subtotal}
            discountAmount={discountAmount}
            taxAmount={taxAmount}
            total={total}
            cartDiscount={cartDiscount}
            onUpdateQuantity={updateItemQuantity}
            onRemoveItem={removeItem}
            onApplyDiscount={handleApplyDiscount}
            onRemoveDiscount={removeDiscount}
            onClearCart={clearCart}
            onHoldOrder={() => setShowHoldModal(true)}
            onPay={() => setShowPaymentModal(true)}
            heldOrdersCount={heldOrdersCount}
            onOpenHeldOrders={() => setShowHeldOrdersList(true)}
            discountError={discountError}
            setDiscountError={setDiscountError}
            isApplyingDiscount={isApplyingDiscount}
          />
        ) : (
          <div className="w-96 max-w-md bg-white border-l border-gray-200 flex flex-col h-full">
            <CurrentOrder
              subtotal={subtotal}
              discountAmount={discountAmount}
              taxAmount={taxAmount}
              total={total}
              cartDiscount={cartDiscount}
              onRemoveDiscount={removeDiscount}
              onApplyDiscount={handleApplyDiscount}
              onClearCart={clearCart}
              onHoldOrder={() => setShowHoldModal(true)}
              onPay={() => setShowPaymentModal(true)}
              cashierName={user?.name || 'Unknown'}
              heldOrdersCount={heldOrdersCount}
              onOpenHeldOrders={() => setShowHeldOrdersList(true)}
              discountError={discountError}
              setDiscountError={setDiscountError}
              showItemsList={false}
            />
          </div>
        )}
      </div>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={handlePaymentConfirm}
        total={total}
      />

      {showReceipt && completedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={handleCloseReceipt}
          />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Transaction Complete</h2>
              <button 
                onClick={handleCloseReceipt}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

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

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                onClick={handlePrint}
              >
                <Printer className="h-5 w-5 inline mr-2" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      <HoldOrderModal
        isOpen={showHoldModal}
        onClose={() => setShowHoldModal(false)}
        onHold={handleHoldOrder}
        isLoading={isHolding}
      />

      <HeldOrdersList
        isOpen={showHeldOrdersList}
        onClose={() => setShowHeldOrdersList(false)}
        onResume={handleResumeOrder}
        onDelete={handleDeleteHeldOrder}
        storeId={user?.storeId || ''}
        cashierId={user?.id || ''}
      />

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

      <ShiftModal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
        mode={activeShift ? 'close' : 'open'}
      />
    </div>
  );
}
