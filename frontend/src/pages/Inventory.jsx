import React, { useState, useEffect, useRef } from 'react';
import { productsAPI, categoriesAPI, suppliersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Package, Plus, Edit2, Trash2, ArrowUpDown, 
  Upload, Download, AlertTriangle, Check, RefreshCw, 
  Sliders, Image
} from 'lucide-react';

const Inventory = () => {
  const { user } = useAuth();
  const canEditInventory = !!user?.can_manage_stock;
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  
  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('Stocktake Correction');
  const [showBarcodeModal, setShowBarcodeModal] = useState(null);

  // Form Fields
  const [formData, setFormData] = useState({
    barcode: '',
    name: '',
    brand: '',
    category_id: '',
    supplier_id: '',
    buying_price: 0,
    selling_price: 0,
    gst: 0,
    discount: 0,
    current_stock: 0,
    minimum_stock: 5,
    expiry_date: '',
    manufacturing_date: '',
    batch_number: '',
  });

  const fetchCatalogData = async () => {
    try {
      setLoading(true);
      const [prodData, catData, supData] = await Promise.all([
        productsAPI.getAll({
          query: search || undefined,
          category_id: categoryFilter || undefined,
          status: statusFilter || undefined
        }),
        categoriesAPI.getAll(),
        suppliersAPI.getAll()
      ]);
      setProducts(prodData);
      setCategories(catData);
      setSuppliers(supData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogData();
  }, [search, categoryFilter, statusFilter]);

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      barcode: Math.floor(1000000000000 + Math.random() * 9000000000000).toString(), // Random barcode helper
      name: '',
      brand: '',
      category_id: '',
      supplier_id: '',
      buying_price: 0,
      selling_price: 0,
      gst: 5.0,
      discount: 0.0,
      current_stock: 0,
      minimum_stock: 5,
      expiry_date: '',
      manufacturing_date: '',
      batch_number: '',
    });
    setShowProductModal(true);
  };

  const handleOpenEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      barcode: product.barcode,
      name: product.name,
      brand: product.brand || '',
      category_id: product.category_id || '',
      supplier_id: product.supplier_id || '',
      buying_price: product.buying_price,
      selling_price: product.selling_price,
      gst: product.gst,
      discount: product.discount,
      current_stock: product.current_stock,
      minimum_stock: product.minimum_stock,
      expiry_date: product.expiry_date || '',
      manufacturing_date: product.manufacturing_date || '',
      batch_number: product.batch_number || '',
    });
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        category_id: formData.category_id ? Number(formData.category_id) : null,
        supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
        buying_price: Number(formData.buying_price),
        selling_price: Number(formData.selling_price),
        gst: Number(formData.gst),
        discount: Number(formData.discount),
        current_stock: Number(formData.current_stock),
        minimum_stock: Number(formData.minimum_stock),
        expiry_date: formData.expiry_date || null,
        manufacturing_date: formData.manufacturing_date || null,
      };

      if (editingProduct) {
        await productsAPI.update(editingProduct.id, payload);
      } else {
        await productsAPI.create(payload);
      }
      setShowProductModal(false);
      fetchCatalogData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Save failed');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm('Are you sure you want to remove this product? This will also wipe its sales history records.')) {
      try {
        await productsAPI.delete(id);
        fetchCatalogData();
      } catch (err) {
        alert(err.response?.data?.detail || 'Delete failed');
      }
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    if (!adjustQty) return;
    try {
      await productsAPI.adjustStock(
        adjustingProduct.id,
        Number(adjustQty),
        adjustReason
      );
      setShowAdjustModal(false);
      setAdjustQty('');
      fetchCatalogData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Adjustment failed');
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const res = await productsAPI.importExcel(file);
      alert(res.message);
      fetchCatalogData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Excel import failed');
    }
  };

  const handleClearInventory = async () => {
    const confirmation = window.confirm("WARNING: Are you sure you want to delete all products in the catalog? This will reset all current product stocks to zero. This action is permanent and cannot be undone.");
    if (confirmation) {
      const typeClear = prompt("To confirm catalog reset, please type 'CLEAR' in all capitals:");
      if (typeClear === 'CLEAR') {
        try {
          await productsAPI.clearInventory();
          alert("Departmental store inventory has been successfully cleared.");
          fetchCatalogData();
        } catch (err) {
          alert(err.response?.data?.detail || "Clear inventory failed.");
        }
      } else {
        alert("Reset cancelled. Confirmation keyword did not match.");
      }
    }
  };

  // Canvas Barcode Generator (Code 128)
  const barcodeCanvasRef = useRef(null);
  useEffect(() => {
    if (showBarcodeModal && barcodeCanvasRef.current) {
      const canvas = barcodeCanvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const code = showBarcodeModal.barcode;
      
      // Simple simulated Code 128 drawing
      ctx.fillStyle = '#000000';
      ctx.font = '12px Courier';
      ctx.fillText(code, 40, 75);
      
      // Draw lines based on char codes
      let x = 20;
      ctx.beginPath();
      for (let i = 0; i < code.length; i++) {
        const charCode = code.charCodeAt(i);
        const bin = (charCode % 2 === 0) ? '101100' : '110010';
        for (let j = 0; j < bin.length; j++) {
          const w = (bin[j] === '1') ? 2 : 1;
          ctx.fillStyle = (bin[j] === '1') ? '#000000' : '#ffffff';
          ctx.fillRect(x, 15, w, 50);
          x += w + 1;
        }
      }
    }
  }, [showBarcodeModal]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-title">Inventory Catalog</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Organize products, categories, supplier sheets, and generate barcode tags.</p>
        </div>
        {(canEditInventory || user?.role === 'admin') && (
          <div className="flex flex-wrap gap-2">
            {/* Clear Catalog (Admin Only) */}
            {user?.role === 'admin' && (
              <button 
                onClick={handleClearInventory}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-rose-200 text-rose-500 rounded-xl hover:bg-rose-50 dark:border-rose-950 dark:hover:bg-rose-950/20 active:scale-95 transition-all"
              >
                <Trash2 size={14} /> Clear Catalog
              </button>
            )}

            {/* Export Excel */}
            {canEditInventory && (
              <a 
                href={`${productsAPI.exportExcelUrl}?token=${encodeURIComponent(localStorage.getItem('smartstock_token') || '')}`} 
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border rounded-xl hover:bg-slate-100 dark:border-slate-800"
              >
                <Download size={14} /> Export Excel
              </a>
            )}
            
            {/* Import Excel */}
            {canEditInventory && (
              <label className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border rounded-xl hover:bg-slate-100 dark:border-slate-800 cursor-pointer">
                <Upload size={14} /> Import Excel
                <input type="file" onChange={handleImportExcel} accept=".xlsx,.xls" className="hidden" />
              </label>
            )}

            {/* Add Product */}
            {canEditInventory && (
              <button 
                onClick={handleOpenCreateModal}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg"
              >
                <Plus size={14} /> Add Product
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="p-4 rounded-3xl border border-slate-200 dark:border-slate-800 glass-panel flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by product name, brand, or barcode..."
          className="flex-1 px-4 py-2 rounded-xl border dark:border-slate-800 dark:bg-slate-900 text-xs"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border dark:border-slate-800 dark:bg-slate-900 text-xs"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border dark:border-slate-800 dark:bg-slate-900 text-xs"
        >
          <option value="">All Statuses</option>
          <option value="Available">Available</option>
          <option value="Out of Stock">Out of Stock</option>
        </select>
      </div>

      {/* Catalog Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden glass-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b dark:bg-slate-900 dark:border-slate-800 font-bold">
                <th className="p-4">Barcode</th>
                <th className="p-4">Product Name</th>
                <th className="p-4">Category</th>
                <th className="p-4">Buying Price</th>
                <th className="p-4">Selling Price</th>
                <th className="p-4">Stock</th>
                <th className="p-4 font-bold text-slate-500 dark:text-slate-400">Status</th>
                {canEditInventory && <th className="p-4 text-center font-bold text-slate-500 dark:text-slate-400">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-900">
              {loading && products.length === 0 ? (
                <tr>
                  <td colSpan={canEditInventory ? 8 : 7} className="p-8 text-center text-slate-400">Loading catalog items...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={canEditInventory ? 8 : 7} className="p-8 text-center text-slate-400">No products found matching filters</td>
                </tr>
              ) : (
                products.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                    <td className="p-4 font-mono font-bold">
                      <button 
                        onClick={() => setShowBarcodeModal(prod)}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {prod.barcode}
                      </button>
                    </td>
                    <td className="p-4">
                      <span className="block font-bold">{prod.name}</span>
                      <span className="block text-[10px] text-slate-400">{prod.brand || 'Generic'}</span>
                    </td>
                    <td className="p-4">{prod.category?.name || 'N/A'}</td>
                    <td className="p-4 font-mono">₹{prod.buying_price.toFixed(2)}</td>
                    <td className="p-4 font-mono">₹{prod.selling_price.toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`font-bold ${prod.current_stock <= prod.minimum_stock ? 'text-rose-500' : ''}`}>
                        {prod.current_stock}
                      </span>
                      <span className="text-[9px] text-slate-400 block">Min: {prod.minimum_stock}</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        prod.status === 'Available' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                      }`}>
                        {prod.status}
                      </span>
                    </td>
                    {canEditInventory && (
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => {
                              setAdjustingProduct(prod);
                              setShowAdjustModal(true);
                            }}
                            className="p-2 border border-slate-200 hover:border-amber-400 dark:border-slate-800 rounded-xl hover:bg-amber-50/50 dark:hover:bg-amber-950/20 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 active:scale-95 transition-all"
                            title="Adjust Stock Count"
                          >
                            <Sliders size={13} />
                          </button>
                          <button 
                            onClick={() => handleOpenEditModal(prod)}
                            className="p-2 border border-slate-200 hover:border-indigo-400 dark:border-slate-800 rounded-xl hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 transition-all"
                            title="Edit Product"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(prod.id)}
                            className="p-2 border border-slate-200 hover:border-rose-400 dark:border-slate-800 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-500 hover:text-rose-600 dark:hover:text-rose-450 active:scale-95 transition-all"
                            title="Delete Product"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-2xl p-6 rounded-3xl bg-white border shadow-2xl dark-mode:bg-slate-950 dark-mode:border-slate-800 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold font-title border-b pb-3 mb-4">{editingProduct ? 'Edit Catalog Product' : 'Add New Product'}</h3>
            <form onSubmit={handleSaveProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Product Info */}
              <div>
                <label className="block font-semibold text-slate-400 mb-1">BARCODE SKU</label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                  required
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-400 mb-1">PRODUCT NAME</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-400 mb-1">BRAND</label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900"
                />
              </div>
              
              {/* Category Select */}
              <div>
                <label className="block font-semibold text-slate-400 mb-1">CATEGORY</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900"
                >
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Supplier Select */}
              <div>
                <label className="block font-semibold text-slate-400 mb-1">SUPPLIER</label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier_id: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Price Details */}
              <div>
                <label className="block font-semibold text-slate-400 mb-1">BUYING PRICE (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.buying_price || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, buying_price: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-400 mb-1">SELLING PRICE (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.selling_price || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, selling_price: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-400 mb-1">GST (%)</label>
                <input
                  type="number"
                  value={formData.gst || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, gst: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-400 mb-1">PRODUCT DISCOUNT (%)</label>
                <input
                  type="number"
                  value={formData.discount || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900"
                />
              </div>

              {/* Stock settings */}
              <div>
                <label className="block font-semibold text-slate-400 mb-1">INITIAL STOCK LEVEL</label>
                <input
                  type="number"
                  value={formData.current_stock || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, current_stock: e.target.value }))}
                  disabled={!!editingProduct} // Require using 'Adjust' for editing product stock
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-400 mb-1">MINIMUM stock THRESHOLD</label>
                <input
                  type="number"
                  value={formData.minimum_stock || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, minimum_stock: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900"
                />
              </div>

              {/* Batches and dates */}
              <div>
                <label className="block font-semibold text-slate-400 mb-1">BATCH NUMBER</label>
                <input
                  type="text"
                  value={formData.batch_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, batch_number: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-400 mb-1">EXPIRY DATE</label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900"
                />
              </div>

              <div className="md:col-span-2 flex justify-end gap-2 mt-4 pt-4 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 dark:border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-white border shadow-2xl dark-mode:bg-slate-950 dark-mode:border-slate-800">
            <h3 className="text-md font-bold font-title border-b pb-3 mb-4">Stock Adjustment</h3>
            <form onSubmit={handleAdjustStock} className="space-y-4 text-xs">
              <div>
                <span className="block text-slate-400 mb-1">Product:</span>
                <span className="font-bold text-sm">{adjustingProduct?.name}</span>
                <span className="block text-[10px] text-slate-400 mt-1">Current Stock: {adjustingProduct?.current_stock}</span>
              </div>
              <div>
                <label className="block font-semibold text-slate-400 mb-1">QUANTITY CHANGE</label>
                <input
                  type="number"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="e.g. -5 to subtract, 10 to add"
                  required
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-400 mb-1">ADJUSTMENT REASON</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900"
                >
                  <option value="Stocktake Correction">Stocktake Correction</option>
                  <option value="Damaged Stock Write-off">Damaged Stock Write-off</option>
                  <option value="Expired Product Disposal">Expired Product Disposal</option>
                  <option value="Customer Return Restock">Customer Return Restock</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 dark:border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Preview Modal */}
      {showBarcodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-xs p-6 rounded-3xl bg-white border shadow-2xl dark-mode:bg-slate-950 dark-mode:border-slate-800 text-center">
            <h3 className="text-sm font-bold font-title mb-4">Barcode Label</h3>
            
            <div className="p-3 bg-white border rounded-2xl flex justify-center mb-4">
              <canvas ref={barcodeCanvasRef} width={200} height={100} className="w-48 h-24" />
            </div>

            <div className="text-xs space-y-1 mb-6">
              <span className="block font-bold">{showBarcodeModal.name}</span>
              <span className="block text-slate-500 font-mono">{showBarcodeModal.barcode}</span>
              <span className="block text-slate-500 font-bold">MRP: ₹{showBarcodeModal.selling_price.toFixed(2)}</span>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => {
                  // Trigger direct canvas print or print element
                  const printWindow = window.open('', '_blank');
                  printWindow.document.write(`
                    <html>
                      <body style="text-align:center;font-family:sans-serif;padding:20px;">
                        <h3>${showBarcodeModal.name}</h3>
                        <img src="${barcodeCanvasRef.current.toDataURL()}" style="width:200px;" />
                        <h4>MRP: Rs. ${showBarcodeModal.selling_price.toFixed(2)}</h4>
                        <script>window.onload = function() { window.print(); window.close(); }</script>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs"
              >
                Print Label
              </button>
              <button
                onClick={() => setShowBarcodeModal(null)}
                className="flex-1 py-2.5 border rounded-xl hover:bg-slate-50 dark:border-slate-800 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
