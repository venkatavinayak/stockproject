import React, { useState, useEffect, useRef } from 'react';
import { productsAPI, billingAPI, settingsAPI } from '../services/api';
import { 
  Search, ShoppingCart, Trash2, Plus, Minus, 
  CreditCard, Smartphone, Banknote, HelpCircle, 
  Printer, CheckCircle2, Ticket, Tag, UserCheck
} from 'lucide-react';

const Billing = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState([]);
  
  // Customer details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  
  // Cash calculations
  const [cashReceived, setCashReceived] = useState(0);
  const [changeDue, setChangeDue] = useState(0);

  // Settings
  const [settings, setSettings] = useState({ currency_symbol: '₹' });
  const [loading, setLoading] = useState(false);

  // POS State
  const [showPayModal, setShowPayModal] = useState(false);
  const [completedTx, setCompletedTx] = useState(null);
  const [showReceiptSentBanner, setShowReceiptSentBanner] = useState(false);
  
  // DOM Refs for keyboard shortcuts
  const searchInputRef = useRef(null);

  // Load Settings and Products Catalog
  useEffect(() => {
    settingsAPI.get().then(setSettings).catch(console.error);
    loadProductsCatalog();
  }, []);

  const loadProductsCatalog = () => {
    productsAPI.getAll().then(setAllProducts).catch(console.error);
  };

  // Auto-fill Cash Received when modal opens
  useEffect(() => {
    if (showPayModal) {
      const roundedTotal = Number(getGrandTotal().toFixed(2));
      setCashReceived(roundedTotal);
      setChangeDue(0);
    }
  }, [showPayModal]);

  // Hotkey listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F2: Focus Search
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // F12: Instant Cash Payment
      if (e.key === 'F12') {
        e.preventDefault();
        if (cart.length > 0 && !showPayModal && !isCheckoutDisabled) {
          setShowPayModal(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, showPayModal, customerName, customerPhone, customerEmail]);

  // Handle Search Query for suggestions popup
  useEffect(() => {
    if (searchQuery.trim().length >= 1) {
      const delaySearch = setTimeout(async () => {
        try {
          const data = await productsAPI.getAll({ query: searchQuery });
          setSearchResults(data);
        } catch (err) {
          console.error(err);
        }
      }, 200);
      return () => clearTimeout(delaySearch);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Barcode quick add
  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    try {
      const data = await productsAPI.getAll({ barcode: searchQuery });
      if (data && data.length > 0) {
        addToCart(data[0]);
        setSearchQuery('');
      } else {
        // Fallback: if search returns single item, add it
        const fallbackData = await productsAPI.getAll({ query: searchQuery });
        if (fallbackData && fallbackData.length === 1) {
          addToCart(fallbackData[0]);
          setSearchQuery('');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addToCart = (product) => {
    if (product.current_stock <= 0) {
      alert(`Product '${product.name}' is out of stock!`);
      return;
    }
    
    setCart((prev) => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.current_stock) {
          alert(`Cannot add more. Only ${product.current_stock} units in stock.`);
          return prev;
        }
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId, change, maxStock) => {
    setCart((prev) => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const nextQty = item.quantity + change;
          if (nextQty <= 0) return null;
          if (nextQty > maxStock) {
            alert(`Cannot exceed stock limit: ${maxStock} units.`);
            return item;
          }
          return { ...item, quantity: nextQty };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const handleManualQtyChange = (productId, val, maxStock) => {
    setCart((prev) => {
      return prev.map(item => {
        if (item.product.id === productId) {
          if (val < 0) return { ...item, quantity: 0 };
          if (val > maxStock) {
            alert(`Cannot exceed stock limit: ${maxStock} units.`);
            return { ...item, quantity: maxStock };
          }
          return { ...item, quantity: val };
        }
        return item;
      });
    });
  };

  const handleManualQtyBlur = (productId, val) => {
    if (val <= 0) {
      setCart((prev) => prev.filter(item => item.product.id !== productId));
    }
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Cart math
  const getSubtotal = () => cart.reduce((sum, item) => sum + (item.quantity * item.product.selling_price), 0);
  const getDiscountTotal = () => {
    return cart.reduce((sum, item) => {
      const itemSub = item.quantity * item.product.selling_price;
      return sum + (itemSub * (item.product.discount / 100));
    }, 0);
  };
  const getGstTotal = () => {
    return cart.reduce((sum, item) => {
      const itemSub = item.quantity * item.product.selling_price;
      const itemDisc = itemSub * (item.product.discount / 100);
      const taxable = itemSub - itemDisc;
      return sum + (taxable * (item.product.gst / 100));
    }, 0);
  };
  const getGrandTotal = () => {
    const total = getSubtotal() - getDiscountTotal() + getGstTotal();
    return Math.max(0, total);
  };

  // Cash change logic
  useEffect(() => {
    const total = getGrandTotal();
    if (cashReceived >= total) {
      setChangeDue(cashReceived - total);
    } else {
      setChangeDue(0);
    }
  }, [cashReceived, cart]);

  // Validation: Customer name is mandatory AND at least one contact channel (phone or email) is mandatory
  const isCheckoutDisabled = 
    cart.length === 0 || 
    !customerName.trim() || 
    (!customerPhone.trim() && !customerEmail.trim());

  const handleCheckoutDirect = async (method) => {
    try {
      setLoading(true);
      const payload = {
        payment_method: method,
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          discount_rate: 0.0,
          gst_rate: 0.0
        })),
        discount_amount: 0,
        coupon_code: null,
        cash_received: Number(cashReceived),
        change_given: Number(changeDue),
        customer_name: customerName,
        customer_phone: customerPhone || null,
        customer_email: customerEmail || null
      };
      
      const res = await billingAPI.checkout(payload);
      setCompletedTx(res);
      setShowReceiptSentBanner(false); // Reset print-based auto sending banner
      setCart([]);
      setCashReceived(0);
      setChangeDue(0);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      loadProductsCatalog(); // Refresh catalog stock counts
    } catch (err) {
      alert(err.response?.data?.detail || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
    // Enforce immediate send notice
    setShowReceiptSentBanner(true);
  };

  // Filter products catalog in real-time
  const filteredProducts = allProducts.filter(p => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      p.name.toLowerCase().includes(query) ||
      p.barcode.includes(query) ||
      (p.brand && p.brand.toLowerCase().includes(query))
    );
  });

  // Extract unique categories from loaded products
  const categoriesList = ['All', ...new Set(allProducts.map(p => p.category?.name || 'Uncategorized'))];

  const displayedProducts = filteredProducts.filter(p => {
    if (selectedCategory === 'All') return true;
    const catName = p.category?.name || 'Uncategorized';
    return catName === selectedCategory;
  });

  return (
    <div className="h-full">
      {/* Main Billing POS screen - hidden on print */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
        {/* Left 2 Columns: Search, Basket & Catalog Selector */}
        <div className="lg:col-span-2 flex flex-col h-full space-y-4">
          {/* Barcode Search Header */}
          <div className="p-4 rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
            <form onSubmit={handleSearchSubmit} className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Search size={18} />
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Scan Barcode or Search Product by name (Press F2 to focus)..."
                  className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-955 transition-all text-sm font-semibold"
                />
              </div>
              <button type="submit" className="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-md shadow-indigo-650/10">
                Scan / Add
              </button>
            </form>

            {/* Quick search suggestions popup */}
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 z-50 mt-2 mx-6 rounded-2xl border border-slate-100 bg-white shadow-2xl max-h-60 overflow-y-auto dark:bg-slate-955 dark:border-slate-800 animate-fade-in">
                {searchResults.map((prod) => (
                  <button
                    key={prod.id}
                    onClick={() => {
                      addToCart(prod);
                      setSearchQuery('');
                    }}
                    className="flex items-center justify-between w-full p-3.5 text-left hover:bg-indigo-50/30 hover:pl-5 border-b last:border-0 dark:border-slate-900 dark:hover:bg-slate-900/50 transition-all duration-250"
                  >
                    <div>
                      <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{prod.name}</span>
                      <span className="block text-[10px] text-slate-400 font-semibold mt-0.5">Barcode: {prod.barcode} | Brand: {prod.brand || 'Generic'}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-sm font-black text-indigo-600 dark:text-indigo-400">{settings.currency_symbol}{prod.selling_price.toFixed(2)}</span>
                      <span className="block text-[9px] text-slate-400 mt-0.5 font-bold">In Stock: {prod.current_stock}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Side-by-Side checkout cart & catalog select panel */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden">
            
            {/* Left panel: Basket items */}
            <div className="p-6 rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex flex-col overflow-hidden h-full">
              <div className="flex items-center gap-2 mb-4 border-b pb-3.5 dark:border-slate-800">
                <ShoppingCart size={18} className="text-indigo-600" />
                <h3 className="text-sm font-extrabold font-title uppercase tracking-wider text-slate-800 dark:text-slate-200">Billing Basket</h3>
                <span className="ml-auto text-[10px] kbd-key font-bold">F2 Search</span>
                <span className="text-[10px] kbd-key font-bold">F12 Cash</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 scrollbar-none">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs py-12">
                    <ShoppingCart size={36} className="mb-2 stroke-1 text-slate-300" />
                    <span className="font-bold">POS cart is empty</span>
                    <span className="text-[10px] text-slate-400 mt-1">Scan barcodes or choose items from the catalog.</span>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.product.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-slate-100 dark:bg-slate-950/20 dark:border-slate-850 shadow-sm hover:shadow-md transition-all">
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {item.product.brand || 'GENERIC'}
                          </span>
                          {item.product.current_stock < 10 && (
                            <span className="text-[9px] font-black text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Low Stock ({item.product.current_stock})
                            </span>
                          )}
                        </div>
                        <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{item.product.name}</span>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-semibold">
                          <span>Price: {settings.currency_symbol}{item.product.selling_price.toFixed(2)}</span>
                          <span>•</span>
                          <span>GST: {item.product.gst}%</span>
                          {item.product.discount > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-600 font-bold">Disc: {item.product.discount}%</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Quantity adjustments */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="flex items-center gap-1 bg-white border border-slate-200/60 rounded-xl p-1 dark:bg-slate-900 dark:border-slate-800 shadow-sm">
                          <button 
                            onClick={() => updateQuantity(item.product.id, -1, item.product.current_stock)}
                            className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors"
                          >
                            <Minus size={11} />
                          </button>
                          <input
                            type="number"
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                              handleManualQtyChange(item.product.id, val, item.product.current_stock);
                            }}
                            onBlur={(e) => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                              handleManualQtyBlur(item.product.id, val);
                            }}
                            className="font-mono text-xs font-black w-10 text-center text-slate-850 dark:text-slate-150 bg-transparent border-none p-0 focus:ring-0 focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800 rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button 
                            onClick={() => updateQuantity(item.product.id, 1, item.product.current_stock)}
                            className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors"
                          >
                            <Plus size={11} />
                          </button>
                        </div>

                        <div className="text-right w-20">
                          <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total</span>
                          <span className="block text-sm font-black font-mono text-slate-900 dark:text-white">
                            {(item.quantity * item.product.selling_price * (1 - item.product.discount/100) * (1 + item.product.gst/100)).toFixed(2)}
                          </span>
                        </div>

                        <button 
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right panel: Catalog Select */}
            <div className="p-6 rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex flex-col overflow-hidden h-full">
              <div className="flex items-center gap-2 mb-2 border-b pb-3.5 dark:border-slate-800">
                <Tag size={18} className="text-indigo-600" />
                <h3 className="text-sm font-extrabold font-title uppercase tracking-wider text-slate-800 dark:text-slate-200">Catalog Selector</h3>
              </div>

              {/* Category horizontal scrolling bar */}
              <div className="flex gap-1.5 overflow-x-auto pb-2 pt-1 scrollbar-none mb-3">
                {categoriesList.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                        : 'bg-slate-100/80 text-slate-500 hover:bg-slate-200 dark:bg-slate-950 dark:text-slate-450 dark:hover:bg-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Grid display scroll list */}
              <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-3 pr-1 scrollbar-none">
                {displayedProducts.length === 0 ? (
                  <div className="col-span-2 flex flex-col items-center justify-center h-full text-slate-400 text-xs py-12">
                    <span>No products found matching filters.</span>
                  </div>
                ) : (
                  displayedProducts.map((prod) => {
                    const isOutOfStock = prod.current_stock <= 0;
                    const isLowStock = prod.current_stock <= prod.minimum_stock && !isOutOfStock;
                    
                    return (
                      <button
                        key={prod.id}
                        disabled={isOutOfStock}
                        onClick={() => addToCart(prod)}
                        className={`group flex flex-col justify-between p-3.5 rounded-2xl border text-left transition-all ${
                          isOutOfStock
                            ? 'border-slate-55 bg-slate-55/30 opacity-50 cursor-not-allowed dark:border-slate-950/20'
                            : 'border-slate-100 bg-white hover:border-indigo-400 hover:shadow-md dark:border-slate-850 dark:bg-slate-950 hover:scale-[1.01]'
                        }`}
                      >
                        <div className="w-full">
                          <span className="block text-[9px] text-slate-400 font-black tracking-wider mb-1 uppercase">
                            {prod.brand || 'GENERIC'}
                          </span>
                          <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-2 h-8 leading-tight mb-2">
                            {prod.name}
                          </span>
                        </div>

                        <div className="w-full flex items-end justify-between mt-auto pt-2 border-t border-slate-55 dark:border-slate-900">
                          <div>
                            <span className="block text-sm font-black text-indigo-650 dark:text-indigo-455">
                              {settings.currency_symbol}{prod.selling_price.toFixed(2)}
                            </span>
                            {isOutOfStock ? (
                              <span className="inline-block text-[8px] font-black uppercase text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.2 rounded mt-1">
                                Out of Stock
                              </span>
                            ) : isLowStock ? (
                              <span className="inline-block text-[8px] font-black uppercase text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.2 rounded mt-1 animate-pulse">
                                Low ({prod.current_stock})
                              </span>
                            ) : (
                              <span className="block text-[8px] text-slate-400 mt-1 font-semibold">
                                Stock: {prod.current_stock}
                              </span>
                            )}
                          </div>
                          
                          <div className={`p-1.5 rounded-lg transition-colors ${
                            isOutOfStock 
                              ? 'bg-slate-100 text-slate-400' 
                              : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-950/30 dark:text-indigo-400'
                          }`}>
                            <Plus size={11} />
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Checkout Console, Pinned summaries and actions at the top */}
        <div className="p-6 rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex flex-col h-full justify-between no-print overflow-hidden">
          
          {/* 1. Invoice Summary (Always pinned at the top) */}
          <div className="space-y-3.5 pb-4 border-b dark:border-slate-800">
            <h3 className="text-xs font-black font-title text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Checkout Summary</h3>
            <div className="space-y-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Cart Subtotal</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{settings.currency_symbol}{getSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Savings Discount</span>
                <span className="font-bold">-{settings.currency_symbol}{getDiscountTotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST Tax Collected</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{settings.currency_symbol}{getGstTotal().toFixed(2)}</span>
              </div>
              
              <div className="border-t border-slate-100 dark:border-slate-850 pt-3 flex items-center justify-between text-slate-800 dark:text-white">
                <span className="text-xs font-black uppercase tracking-wider">Grand Total</span>
                <span className="font-mono text-xl font-black text-indigo-650 dark:text-indigo-455">{settings.currency_symbol}{getGrandTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* 2. Primary Checkout Actions (Placed immediately below Grand Total!) */}
          <div className="py-4 space-y-2.5 border-b dark:border-slate-800">
            <button 
              disabled={isCheckoutDisabled}
              onClick={() => setShowPayModal(true)}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-100 disabled:to-slate-250 disabled:text-slate-400 font-extrabold text-sm shadow-md shadow-emerald-600/10 active:scale-[0.98] transition-all"
            >
              Cash Checkout (F12)
            </button>
            
            <div className="grid grid-cols-2 gap-2.5">
              <button 
                disabled={isCheckoutDisabled}
                onClick={() => handleCheckoutDirect('UPI')}
                className="py-3 rounded-2xl border border-slate-200 dark:border-slate-805 bg-slate-50/50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 font-extrabold flex items-center justify-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Smartphone size={14} className="text-indigo-600" /> UPI Pay
              </button>
              <button 
                disabled={isCheckoutDisabled}
                onClick={() => handleCheckoutDirect('Card')}
                className="py-3 rounded-2xl border border-slate-200 dark:border-slate-805 bg-slate-50/50 hover:bg-slate-100 dark:bg-slate-955 dark:hover:bg-slate-900 font-extrabold flex items-center justify-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CreditCard size={14} className="text-indigo-600" /> Card Pay
              </button>
            </div>

            {/* Validation Notice Banner */}
            {isCheckoutDisabled && cart.length > 0 && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/20 text-[10px] text-amber-700 dark:text-amber-400 font-extrabold flex items-center gap-1.5 animate-pulse mt-2">
                <span>⚠️ Required: Customer Name + (Mobile or Email) to complete checkout.</span>
              </div>
            )}
          </div>

          {/* 3. Customer Info Inputs (Scrollable container below the payment actions) */}
          <div className="flex-1 overflow-y-auto pt-4 space-y-4 scrollbar-none pr-1">
            
            {/* Customer Details Form */}
            <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-850/80 bg-slate-50/50 dark:bg-slate-955/20 space-y-3.5">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <UserCheck size={14} className="text-indigo-600" />
                <span className="text-[10px] font-black uppercase tracking-wider">Customer Contact (Mandatory)</span>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Customer Name *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name..."
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 transition-all"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Mobile Number *</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Email Address *</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="customer@email.com"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 transition-all"
                  />
                </div>
              </div>
              <span className="block text-[8px] text-slate-400 font-semibold italic text-center">
                * Note: Either Mobile Number or Email is required.
              </span>
            </div>

          </div>
        </div>
      </div>

      {/* Simplified Cash Pay Modal */}
      {showPayModal && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 animate-backdrop-fade">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-white border shadow-2xl dark:bg-slate-955 dark:border-slate-800 animate-modal-pop">
            <h3 className="text-md font-bold font-title border-b pb-3 mb-4">Complete Cash Transaction</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between font-bold text-sm bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
                <span>Grand Total:</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-mono">{settings.currency_symbol}{getGrandTotal().toFixed(2)}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">CASH RECEIVED</label>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setCashReceived(val);
                    setChangeDue(Math.max(0, val - Number(getGrandTotal().toFixed(2))));
                  }}
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-4 py-3 rounded-2xl border bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50 text-md font-mono font-bold focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Change Due:</span>
                <span className="font-bold text-emerald-600 font-mono text-sm">{settings.currency_symbol}{changeDue.toFixed(2)}</span>
              </div>

              <button
                onClick={() => {
                  handleCheckoutDirect('Cash');
                  setShowPayModal(false);
                }}
                disabled={Number(cashReceived.toFixed(2)) < Number(getGrandTotal().toFixed(2))}
                className="w-full py-3 rounded-2xl bg-emerald-600 disabled:bg-emerald-850 text-white font-bold"
              >
                Confirm Paid & Print Bill
              </button>
            </div>

            <button 
              onClick={() => setShowPayModal(false)}
              className="w-full mt-3 py-2 text-xs border rounded-xl hover:bg-slate-50 dark:border-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Checkout Success Printable Receipt Overlay */}
      {completedTx && (
        <div className="print-only-container fixed inset-0 z-50 flex items-center justify-center p-4 animate-backdrop-fade">
          <div className="no-print-card w-full max-w-sm p-6 rounded-3xl bg-white border shadow-2xl dark:bg-slate-955 dark:border-slate-800 max-h-[85vh] flex flex-col justify-between animate-modal-pop">
            <div className="text-center mb-4 no-print">
              <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={36} />
              <h3 className="text-lg font-bold font-title text-slate-900 dark:text-white">Transaction Completed</h3>
              <span className="text-xs text-slate-400">{completedTx.invoice_number}</span>
              {showReceiptSentBanner && (
                <div className="mt-3 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-100/20 animate-bounce">
                  ✨ PDF Receipt has been successfully sent to {completedTx.customer_email || completedTx.customer_phone}!
                </div>
              )}
            </div>

            {/* Thermal Receipt Print Area */}
            <div 
              className="flex-1 border border-slate-200 rounded-2xl p-5 overflow-y-auto bg-white text-slate-900 mb-4 print-receipt shadow-inner" 
              id="thermal-receipt-print-area"
              style={{ fontFamily: 'monospace' }}
            >
              {/* Header */}
              <div className="text-center mb-3">
                <div className="text-sm font-black tracking-wider uppercase text-slate-955">{settings.store_name || "SMART RETAIL STORE"}</div>
                <div className="text-[8px] tracking-widest text-slate-500 uppercase mt-0.5 font-bold">Premium Retail Experience</div>
                
                <div className="text-[8px] leading-relaxed text-slate-600 mt-2 font-semibold">
                  {settings.address && <span className="block">{settings.address}</span>}
                  {settings.contact_info && <span className="block">Ph: {settings.contact_info}</span>}
                  {settings.gst_number && <span className="block">GSTIN: {settings.gst_number}</span>}
                </div>
              </div>
              
              {/* Divider */}
              <div className="border-b border-dashed border-slate-300 my-2"></div>
              
              {/* Receipt Metadata */}
              <div className="grid grid-cols-2 gap-y-0.5 text-[8px] text-slate-700 font-semibold mb-2">
                <div>INVOICE: {completedTx.invoice_number}</div>
                <div className="text-right">DATE: {new Date(completedTx.timestamp).toLocaleDateString()}</div>
                <div>CASHIER: Owner</div>
                <div className="text-right">TIME: {new Date(completedTx.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                <div className="col-span-2">PAYMENT: {completedTx.payment_method}</div>
              </div>

              {/* Customer Details in receipt */}
              {(completedTx.customer_name || completedTx.customer_phone || completedTx.customer_email) && (
                <>
                  <div className="border-b border-dashed border-slate-300 my-2"></div>
                  <div className="text-[8px] text-slate-700 font-semibold mb-2 space-y-0.5">
                    {completedTx.customer_name && <div>CUSTOMER: {completedTx.customer_name}</div>}
                    {completedTx.customer_phone && <div>PHONE: {completedTx.customer_phone}</div>}
                    {completedTx.customer_email && <div>EMAIL: {completedTx.customer_email}</div>}
                  </div>
                </>
              )}
              
              {/* Divider */}
              <div className="border-b border-dashed border-slate-300 my-2"></div>
              
              {/* Items Table Header */}
              <div className="grid grid-cols-12 text-[8px] font-bold text-slate-900 mb-1 uppercase">
                <span className="col-span-6">Item</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Price</span>
                <span className="col-span-2 text-right">Total</span>
              </div>
              
              {/* Divider */}
              <div className="border-b border-dashed border-slate-300 mb-2"></div>
              
              {/* Items List */}
              <div className="space-y-1.5 text-[8px] text-slate-800 font-semibold">
                {completedTx.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 items-start">
                    <div className="col-span-6 truncate pr-1">
                      <span className="font-bold">{item.product?.name || 'Retail Item'}</span>
                      {item.product?.brand && <span className="block text-[7px] text-slate-400 normal-case font-normal">{item.product.brand}</span>}
                    </div>
                    <span className="col-span-2 text-center">{item.quantity}</span>
                    <span className="col-span-2 text-right">{settings.currency_symbol}{item.unit_selling_price.toFixed(2)}</span>
                    <span className="col-span-2 text-right font-bold">{settings.currency_symbol}{item.total_amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              {/* Divider */}
              <div className="border-b border-dashed border-slate-300 my-2"></div>
              
              {/* Financial Breakdown */}
              <div className="space-y-1 text-[8px] text-slate-800 font-semibold">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span>{settings.currency_symbol}{completedTx.subtotal.toFixed(2)}</span>
                </div>
                {completedTx.discount_amount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>SAVINGS:</span>
                    <span>-{settings.currency_symbol}{completedTx.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500 text-[7px]">
                  <span>CGST (2.5%):</span>
                  <span>{settings.currency_symbol}{(completedTx.gst_amount / 2).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[7px]">
                  <span>SGST (2.5%):</span>
                  <span>{settings.currency_symbol}{(completedTx.gst_amount / 2).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST TOTAL:</span>
                  <span>{settings.currency_symbol}{completedTx.gst_amount.toFixed(2)}</span>
                </div>
                
                <div className="border-b border-double border-slate-400 my-2"></div>
                
                <div className="flex justify-between text-xs font-black text-slate-900 pt-0.5">
                  <span>GRAND TOTAL:</span>
                  <span>{settings.currency_symbol}{completedTx.grand_total.toFixed(2)}</span>
                </div>
              </div>
              
              {/* Footer */}
              <div className="text-center mt-5 space-y-1 border-t border-dashed border-slate-200 pt-3">
                <div className="text-[8px] font-bold text-slate-900 uppercase tracking-wide">THANK YOU FOR YOUR SHOPPING!</div>
                <div className="text-[7px] text-slate-500">Goods once sold can be returned within 7 days.</div>
                <div className="text-[7px] text-slate-500">Please present this slip for refund/exchange.</div>
                <div className="text-[8px] font-bold text-indigo-600/80 pt-1 tracking-wider uppercase">*** SMART STORE AI POWERED ***</div>
              </div>
            </div>

            {/* Print and Close controls */}
            <div className="space-y-3 no-print">
              <button
                onClick={handlePrintReceipt}
                className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                <Printer size={16} /> Print Receipt
              </button>
              <button
                onClick={() => setCompletedTx(null)}
                className="w-full py-2 text-xs border rounded-xl hover:bg-slate-50 dark:border-slate-800"
              >
                New Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
