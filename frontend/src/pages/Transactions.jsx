import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  getOrders, 
  getOrder, 
  voidOrder, 
  refundOrder, 
  bulkReviewOrders 
} from '../api/orders';
import { getUsers } from '../api/users';
import { getSettings } from '../api/settings';
import { printOrderViaBackend } from '../api/print';
import { connectQZ, printReceipt } from '../utils/qzPrint';
import { 
  Search, 
  Calendar, 
  ChevronDown, 
  Filter, 
  Download, 
  Receipt, 
  Loader, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Lock, 
  RefreshCw, 
  User, 
  Printer, 
  Clock, 
  CreditCard, 
  ArrowLeft, 
  HelpCircle,
  Eye,
  Trash2,
  Undo2,
  CheckSquare,
  Square,
  Wifi,
  Monitor
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatRupiah } from '../utils/format';
import { exportToCSV } from '../utils/export';
import { useAutoAnimate } from '@formkit/auto-animate/react';

export default function Transactions() {
  const [tableRef] = useAutoAnimate();
  const [drawerRef] = useAutoAnimate();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter & Search States
  const getTodayDateString = () => {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
  };

  const getDefaultDateFrom = () => {
    if (user?.role === 'cashier') return getTodayDateString();
    return getTodayDateString(); // Default to Today as per spec
  };

  const [dateFrom, setDateFrom] = useState(getDefaultDateFrom());
  const [dateTo, setDateTo] = useState(getTodayDateString());
  const [datePreset, setDatePreset] = useState('today');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [cashierFilter, setCashierFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Data States
  const [orders, setOrders] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // Drawer / Selection States
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modals & PIN Overrides
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinActionType, setPinActionType] = useState('void'); // 'void' | 'refund'
  const [supervisorPin, setSupervisorPin] = useState('');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Void/Refund Forms
  const [voidReason, setVoidReason] = useState('Accidental Double Charge');
  const [voidNotes, setVoidNotes] = useState('');
  const [refundItems, setRefundItems] = useState({}); // order_item_id -> qty
  const [refundMethod, setRefundMethod] = useState('cash'); // cash | qris | voucher
  const [refundReason, setRefundReason] = useState('Wrong Item Prepared');
  const [refundNotes, setRefundNotes] = useState('');

  // Print Statuses
  const [qzStatus, setQzStatus] = useState('idle');
  const [printing, setPrinting] = useState(false);
  const [networkPrinting, setNetworkPrinting] = useState(false);

  // HID Barcode Scanner Buffer
  const scanBuffer = useRef('');
  const lastKeyTime = useRef(0);

  // Load Initial Settings & Cashier Lists
  useEffect(() => {
    getSettings().then(r => setSettings(r.data)).catch(() => {});
    if (user?.role !== 'cashier') {
      getUsers().then(r => {
        setCashiers(r.data.filter(u => u.role === 'cashier' || u.role === 'owner'));
      }).catch(() => {});
    }
    handleConnectQZ();
  }, []);

  // Search Debounce (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load Orders when filters, search query, or sort values change
  useEffect(() => {
    loadOrders();
  }, [dateFrom, dateTo, statusFilter, paymentFilter, cashierFilter, debouncedSearch, sortBy, sortOrder]);

  // Check URL query parameters for direct order opening
  useEffect(() => {
    const orderIdParam = searchParams.get('id');
    if (orderIdParam) {
      handleOpenOrder(parseInt(orderIdParam));
    }
  }, [searchParams]);

  // Load Orders API Call
  const loadOrders = () => {
    setLoading(true);
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (statusFilter) params.status = statusFilter;
    if (paymentFilter) params.payment_method = paymentFilter;
    if (cashierFilter) params.cashier_id = cashierFilter;
    if (debouncedSearch) params.search = debouncedSearch;

    getOrders(params)
      .then((r) => {
        let fetchedOrders = r.data || [];
        
        // Sorting logic (frontend safeguard/flexibility)
        fetchedOrders.sort((a, b) => {
          let valA = a[sortBy];
          let valB = b[sortBy];
          if (sortBy === 'created_at') {
            valA = new Date(a.created_at).getTime();
            valB = new Date(b.created_at).getTime();
          }
          if (valA < valB) return sortOrder === 'desc' ? 1 : -1;
          if (valA > valB) return sortOrder === 'desc' ? -1 : 1;
          return 0;
        });

        // HID Scanner Automation: If exactly 1 matching result returned from search query, auto-open it
        if (debouncedSearch && fetchedOrders.length === 1 && !selectedOrderId) {
          handleOpenOrder(fetchedOrders[0].id);
          toast.success(`Menemukan transaksi ${fetchedOrders[0].order_number}`);
        }

        setOrders(fetchedOrders);
      })
      .catch(() => {
        toast.error('Gagal memuat daftar transaksi');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Connect to QZ Tray helper
  const handleConnectQZ = async () => {
    if (qzStatus === 'connecting') return;
    setQzStatus('connecting');
    try {
      await connectQZ();
      setQzStatus('connected');
    } catch {
      setQzStatus('error');
    }
  };

  // Open Details Drawer
  const handleOpenOrder = (id) => {
    setSelectedOrderId(id);
    setSearchParams({ id: id.toString() });
    getOrder(id)
      .then((r) => {
        setSelectedOrder(r.data);
      })
      .catch(() => {
        toast.error('Gagal memuat detail transaksi');
        handleCloseDrawer();
      });
  };

  // Close Drawer
  const handleCloseDrawer = () => {
    setSelectedOrderId(null);
    setSelectedOrder(null);
    setSearchParams({});
  };

  // Apply Quick Date Preset
  const handleApplyPreset = (preset) => {
    setDatePreset(preset);
    const todayStr = getTodayDateString();
    
    if (preset === 'today') {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      setDateFrom(yesterdayStr);
      setDateTo(yesterdayStr);
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setDateFrom(past.toISOString().split('T')[0]);
      setDateTo(todayStr);
    } else if (preset === '30days') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setDateFrom(past.toISOString().split('T')[0]);
      setDateTo(todayStr);
    } else if (preset === 'month') {
      const date = new Date();
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
      const tzOffset = firstDay.getTimezoneOffset() * 60000;
      const firstDayStr = (new Date(firstDay.getTime() - tzOffset)).toISOString().split('T')[0];
      setDateFrom(firstDayStr);
      setDateTo(todayStr);
    }
  };

  // Sort Toggle handler
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Checkbox row selectors
  const toggleRow = (id) => {
    const updated = new Set(selectedRows);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedRows(updated);
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === orders.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(orders.map(o => o.id)));
    }
  };

  // Reset all search parameters
  const handleResetFilters = () => {
    setDatePreset('today');
    setDateFrom(getDefaultDateFrom());
    setDateTo(getTodayDateString());
    setStatusFilter('');
    setPaymentFilter('');
    setCashierFilter('');
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedRows(new Set());
  };

  // Keyboard Shortcuts Global Event Handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Barcode Scanner detection (keypress speed < 50ms)
      const currentTime = new Date().getTime();
      const timeDiff = currentTime - lastKeyTime.current;
      lastKeyTime.current = currentTime;

      // Ignore inputs/textarea/selects for scanner global redirect
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.tagName === 'SELECT'
      );

      if (e.key === 'Enter') {
        if (!isInputFocused && scanBuffer.current.length > 3) {
          e.preventDefault();
          const scannedCode = scanBuffer.current.trim();
          setSearchQuery(scannedCode);
          scanBuffer.current = '';
          return;
        }
        scanBuffer.current = '';
      } else if (e.key.length === 1) {
        if (timeDiff < 50) {
          scanBuffer.current += e.key;
        } else {
          // Reset buffer if typing slow (manual key)
          scanBuffer.current = e.key;
        }
      }

      // Keyboard Accessibility Shortcuts
      if (isInputFocused) return; // Disable hotkeys when user is actively writing
      
      switch (e.key.toLowerCase()) {
        case 'f':
        case '/':
          e.preventDefault();
          const searchInput = document.getElementById('receipt-search-field');
          if (searchInput) searchInput.focus();
          break;
        case 'escape':
          e.preventDefault();
          if (showRefundModal) setShowRefundModal(false);
          else if (showVoidModal) setShowVoidModal(false);
          else if (showPinModal) setShowPinModal(false);
          else if (selectedOrderId) handleCloseDrawer();
          break;
        case 'p':
          if (selectedOrder) {
            e.preventDefault();
            handleQZPrint();
          }
          break;
        case 'r':
          if (selectedOrder && selectedOrder.status !== 'voided' && selectedOrder.status !== 'refunded') {
            e.preventDefault();
            handleOpenRefundFlow();
          }
          break;
        case 'v':
          if (selectedOrder && selectedOrder.status !== 'voided' && !selectedOrder.refunded_amount) {
            e.preventDefault();
            handleOpenVoidFlow();
          }
          break;
        case '?':
          e.preventDefault();
          setShowShortcutsModal(prev => !prev);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrderId, selectedOrder, showRefundModal, showVoidModal, showPinModal]);

  // Supervisor PIN dialog check
  const handleOpenVoidFlow = () => {
    if (user?.role === 'owner' || user?.role === 'supervisor') {
      // Bypasses auth pin if operating supervisor already
      setSupervisorPin(user.pin || '1234');
      setShowVoidModal(true);
    } else {
      setPinActionType('void');
      setSupervisorPin('');
      setShowPinModal(true);
    }
  };

  const handleOpenRefundFlow = () => {
    // Reset quantities count for new itemized returns
    const itemsQty = {};
    selectedOrder?.items.forEach(item => {
      // calculate already returned quantity
      let returned = 0;
      selectedOrder.refunds.forEach(ref => {
        ref.items.forEach(refItem => {
          if (refItem.order_item_id === item.id) {
            returned += refItem.quantity;
          }
        });
      });
      itemsQty[item.id] = 0; // default 0 returned
    });
    setRefundItems(itemsQty);
    setRefundNotes('');

    if (user?.role === 'owner' || user?.role === 'supervisor') {
      setSupervisorPin(user.pin || '1234');
      setShowRefundModal(true);
    } else {
      setPinActionType('refund');
      setSupervisorPin('');
      setShowPinModal(true);
    }
  };

  // PIN validation handler
  const handleVerifyPin = () => {
    if (!supervisorPin) {
      toast.error('Masukkan PIN Otorisasi');
      return;
    }
    
    // Quick validation
    setShowPinModal(false);
    if (pinActionType === 'void') {
      setShowVoidModal(true);
    } else {
      setShowRefundModal(true);
    }
  };

  // Submit Void request
  const handleSubmitVoid = () => {
    if (!voidReason) {
      toast.error('Alasan void harus diisi');
      return;
    }
    
    setPrinting(true);
    voidOrder(selectedOrder.id, {
      supervisor_pin: supervisorPin,
      reason_code: voidReason,
      notes: voidNotes
    })
      .then((r) => {
        toast.success(`Transaksi ${selectedOrder.order_number} berhasil divoid`);
        setSelectedOrder(r.data);
        setShowVoidModal(false);
        loadOrders();
      })
      .catch((err) => {
        toast.error(err.response?.data?.detail || 'Otorisasi PIN gagal atau order sudah disettle');
      })
      .finally(() => {
        setPrinting(false);
      });
  };

  // Submit Refund request
  const handleSubmitRefund = () => {
    const requestItems = Object.entries(refundItems)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => ({
        order_item_id: parseInt(id),
        quantity: qty
      }));

    // If items specified, check that at least one is greater than 0
    if (requestItems.length === 0) {
      toast.error('Pilih minimal 1 item untuk dikembalikan');
      return;
    }

    setPrinting(true);
    refundOrder(selectedOrder.id, {
      supervisor_pin: supervisorPin,
      reason_code: refundReason,
      notes: refundNotes,
      refund_method: refundMethod,
      items: requestItems
    })
      .then((r) => {
        toast.success(`Refund berhasil diproses`);
        setSelectedOrder(r.data);
        setShowRefundModal(false);
        loadOrders();
      })
      .catch((err) => {
        toast.error(err.response?.data?.detail || 'Gagal memproses refund');
      })
      .finally(() => {
        setPrinting(false);
      });
  };

  // Owner Bulk Review Action
  const handleBulkReview = () => {
    if (selectedRows.size === 0) return;
    const ids = Array.from(selectedRows);
    bulkReviewOrders({ order_ids: ids })
      .then(() => {
        toast.success(`${ids.length} order berhasil ditinjau & dikunci`);
        setSelectedRows(new Set());
        loadOrders();
        if (selectedOrderId && ids.includes(selectedOrderId)) {
          handleOpenOrder(selectedOrderId);
        }
      })
      .catch(() => {
        toast.error('Gagal memproses tinjauan bulk');
      });
  };

  // CSV Export for filtered items
  const handleExportCSV = () => {
    if (orders.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }
    const headers = ['No. Order', 'Tipe', 'Kasir', 'Pembayaran', 'Subtotal', 'Diskon', 'Total Refund', 'Net Total', 'Status', 'Ditinjau', 'Waktu'];
    const rows = orders.map(o => [
      o.order_number,
      o.order_type === 'dine_in' ? 'Dine In' : 'Takeaway',
      o.cashier_name || '-',
      o.payment_method.toUpperCase(),
      o.subtotal || 0,
      o.discount || 0,
      o.refunded_amount || 0,
      o.net_total || 0,
      o.status.toUpperCase(),
      o.is_reviewed ? 'YA' : 'TIDAK',
      o.created_at ? new Date(o.created_at).toLocaleString('id-ID') : '-'
    ]);
    exportToCSV(`Riwayat_Transaksi_KopiPOS_${dateFrom || 'All'}_${dateTo || 'All'}`, headers, rows);
  };

  // Bulk Export CSV for checked items
  const handleBulkExportCSV = () => {
    const selectedOrders = orders.filter(o => selectedRows.has(o.id));
    if (selectedOrders.length === 0) return;
    const headers = ['No. Order', 'Tipe', 'Kasir', 'Pembayaran', 'Subtotal', 'Diskon', 'Total Refund', 'Net Total', 'Status', 'Ditinjau', 'Waktu'];
    const rows = selectedOrders.map(o => [
      o.order_number,
      o.order_type === 'dine_in' ? 'Dine In' : 'Takeaway',
      o.cashier_name || '-',
      o.payment_method.toUpperCase(),
      o.subtotal || 0,
      o.discount || 0,
      o.refunded_amount || 0,
      o.net_total || 0,
      o.status.toUpperCase(),
      o.is_reviewed ? 'YA' : 'TIDAK',
      o.created_at ? new Date(o.created_at).toLocaleString('id-ID') : '-'
    ]);
    exportToCSV(`Bulk_Transaksi_Export_${selectedOrders.length}`, headers, rows);
    setSelectedRows(new Set());
  };

  // Direct Network printer route
  const handleNetworkPrint = async () => {
    if (!selectedOrder) return;
    setNetworkPrinting(true);
    try {
      await printOrderViaBackend(selectedOrder.id, {
        printerIp:   settings?.printer_ip   || undefined,
        printerPort: settings?.printer_port  ? parseInt(settings.printer_port) : undefined,
        printerType: settings?.printer_type  || 'network',
        paperWidth:  settings?.paper_width   ? parseInt(settings.paper_width) : 58,
      });
      toast.success('Struk berhasil dicetak ke printer jaringan');
    } catch (err) {
      toast.error('Gagal cetak via jaringan: ' + (err.response?.data?.detail || err.message));
    } finally {
      setNetworkPrinting(false);
    }
  };

  // QZ Tray WebSocket Print job
  const handleQZPrint = async () => {
    if (!selectedOrder) return;
    if (qzStatus !== 'connected') {
      await handleConnectQZ();
      return;
    }
    setPrinting(true);
    try {
      const printerName = settings?.default_printer || null;
      await printReceipt(selectedOrder, settings || {}, printerName);
      toast.success('Struk berhasil dicetak via QZ Tray');
    } catch (err) {
      toast.error('Gagal cetak: ' + (err.message || 'Error tidak diketahui'));
    } finally {
      setPrinting(false);
    }
  };

  // Helper values for dynamically calculating refund totals in modal
  const calculateRefundModalTotals = () => {
    if (!selectedOrder) return { subtotal: 0, discount: 0, total: 0 };
    let subtotal = 0;
    selectedOrder.items.forEach(item => {
      const qty = refundItems[item.id] || 0;
      subtotal += item.unit_price * qty;
    });
    const discountRatio = selectedOrder.subtotal > 0 ? (selectedOrder.discount / selectedOrder.subtotal) : 0;
    const discount = subtotal * discountRatio;
    const total = subtotal - discount;
    return { subtotal, discount, total };
  };

  // Status mapping layout pills
  const renderStatusBadge = (statusStr) => {
    const maps = {
      paid: { text: 'Paid', cls: 'bg-success/10 text-success border-success/20' },
      pending: { text: 'Pending', cls: 'bg-info/10 text-info border-info/20' },
      partially_refunded: { text: 'Partial Refund', cls: 'bg-warning/10 text-warning border-warning/20' },
      refunded: { text: 'Refunded', cls: 'bg-danger/10 text-danger border-danger/20' },
      voided: { text: 'Voided', cls: 'bg-surface-3 text-text-muted border-border' },
      failed: { text: 'Failed', cls: 'bg-danger/10 text-danger border-danger/20' },
      cancelled: { text: 'Cancelled', cls: 'bg-surface-3 text-text-muted border-border' }
    };
    const active = maps[statusStr] || { text: statusStr, cls: 'bg-surface-3 text-text-primary border-border' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${active.cls}`}>
        {active.text}
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-[calc(1rem+10px)] w-full max-w-[1500px] mx-auto animate-in relative">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-br from-white to-primary bg-clip-text text-transparent">
            Riwayat Transaksi
          </h1>
          <p className="text-sm text-text-secondary mt-1">Audit, kelola void/refund, dan cetak struk penjualan</p>
        </div>
        
        {/* Owner-only CSV export button */}
        {user?.role === 'owner' && (
          <button 
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-sans text-sm font-semibold cursor-pointer border bg-surface-2 text-text-primary border-border hover:bg-surface-3 hover:border-text-muted transition-all w-full md:w-auto"
            onClick={handleExportCSV}
          >
            <Download size={16} /> Export CSV
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between hover:border-primary/20 transition-all duration-200 shadow-sm">
          <div>
            <span className="text-xs font-medium text-text-secondary block">Transaksi Hari Ini</span>
            <span className="text-xl sm:text-2xl font-bold text-text-primary block mt-1">
              {orders.filter(o => o.created_at?.split('T')[0] === getTodayDateString()).length}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Receipt size={20} />
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between hover:border-success/20 transition-all duration-200 shadow-sm">
          <div>
            <span className="text-xs font-medium text-text-secondary block">Revenue Hari Ini</span>
            <span className="text-xl sm:text-2xl font-bold text-success block mt-1">
              {formatRupiah(orders
                .filter(o => o.created_at?.split('T')[0] === getTodayDateString() && o.status !== 'voided')
                .reduce((acc, o) => acc + o.net_total, 0)
              )}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-success-bg text-success">
            <Wifi size={20} />
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between hover:border-danger/20 transition-all duration-200 shadow-sm">
          <div>
            <span className="text-xs font-medium text-text-secondary block">Total Refunded Hari Ini</span>
            <span className="text-xl sm:text-2xl font-bold text-danger block mt-1">
              {formatRupiah(orders
                .filter(o => o.created_at?.split('T')[0] === getTodayDateString())
                .reduce((acc, o) => acc + o.refunded_amount, 0)
              )}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-danger-bg text-danger">
            <Undo2 size={20} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar Section */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-6 shadow-sm">
        
        {/* Date presets toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-border">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider mr-2">Periode:</span>
          {['today', 'yesterday', '7days', '30days', 'month'].map((preset) => {
            const labels = { today: 'Hari Ini', yesterday: 'Kemarin', '7days': '7 Hari Terakhir', '30days': '30 Hari Terakhir', month: 'Bulan Ini' };
            const isCashierLimit = user?.role === 'cashier' && (preset === '30days' || preset === 'month');
            if (isCashierLimit) return null; // Restrict cashiers to max last 7 days as per spec

            return (
              <button 
                key={preset}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all border ${
                  datePreset === preset 
                  ? 'bg-primary text-white border-primary shadow-sm' 
                  : 'bg-surface-2 text-text-secondary border-border hover:text-text-primary hover:bg-surface-3'
                }`}
                onClick={() => handleApplyPreset(preset)}
              >
                {labels[preset]}
              </button>
            );
          })}
          <button 
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all border ${
              datePreset === 'custom' 
              ? 'bg-primary text-white border-primary' 
              : 'bg-surface-2 text-text-secondary border-border hover:text-text-primary hover:bg-surface-3'
            }`}
            onClick={() => setDatePreset('custom')}
          >
            Custom
          </button>
        </div>

        {/* Dynamic Filters Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          
          {/* Custom Date Pickers */}
          {datePreset === 'custom' && (
            <>
              <div className="w-full">
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Dari Tanggal</label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary text-sm transition-all focus:border-primary outline-none" 
                  value={dateFrom} 
                  max={getTodayDateString()}
                  onChange={(e) => setDateFrom(e.target.value)} 
                />
              </div>
              <div className="w-full">
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Sampai Tanggal</label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary text-sm transition-all focus:border-primary outline-none" 
                  value={dateTo} 
                  max={getTodayDateString()}
                  onChange={(e) => setDateTo(e.target.value)} 
                />
              </div>
            </>
          )}

          {/* Status Dropdown */}
          <div className="w-full">
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Status Transaksi</label>
            <select 
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary text-sm transition-all focus:border-primary outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Semua Status</option>
              <option value="paid">Paid (Lunas)</option>
              <option value="pending">Pending</option>
              <option value="partially_refunded">Partially Refunded</option>
              <option value="refunded">Refunded (Penuh)</option>
              <option value="voided">Voided</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Payment Method Dropdown */}
          <div className="w-full">
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Metode Pembayaran</label>
            <select 
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary text-sm transition-all focus:border-primary outline-none"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              <option value="">Semua Metode</option>
              <option value="cash">Cash</option>
              <option value="qris">QRIS</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>

          {/* Cashier Selector Dropdown (Hidden for standard Cashiers) */}
          {user?.role !== 'cashier' && (
            <div className="w-full">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Kasir</label>
              <select 
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary text-sm transition-all focus:border-primary outline-none"
                value={cashierFilter}
                onChange={(e) => setCashierFilter(e.target.value)}
              >
                <option value="">Semua Kasir</option>
                {cashiers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Search bar */}
          <div className="w-full sm:col-span-2 lg:col-span-2 relative">
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Cari Nota / Pelanggan</label>
            <div className="relative">
              <input 
                id="receipt-search-field"
                type="text" 
                placeholder="Scan Barcode / No. Nota / Pelanggan..."
                className="w-full pl-9 pr-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 text-text-muted" size={16} />
              {searchQuery && (
                <button 
                  className="absolute right-3 top-2.5 text-text-muted hover:text-text-primary"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Action controls */}
          <div className="flex gap-2 w-full lg:col-span-1">
            <button 
              className="flex-1 px-4 py-2 bg-surface-2 text-text-primary border border-border rounded-lg text-sm font-semibold hover:bg-surface-3 transition-colors cursor-pointer"
              onClick={handleResetFilters}
            >
              Reset
            </button>
            <button 
              className="px-2 py-2 bg-surface-2 text-text-muted border border-border rounded-lg hover:text-text-primary transition-colors cursor-pointer"
              onClick={() => setShowShortcutsModal(true)}
              title="Shortcut keyboard (?)"
            >
              <HelpCircle size={18} />
            </button>
          </div>

        </div>

      </div>

      {/* Main Grid: Left Table, Right Slide Drawer */}
      <div className="flex gap-6 items-start relative min-h-[500px]">
        
        {/* Table Content panel */}
        <div className="flex-1 bg-surface border border-border rounded-xl shadow-sm overflow-hidden transition-all duration-300">
          
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-surface-2 border-b border-border select-none">
                <tr>
                  {user?.role === 'owner' && (
                    <th className="p-4 w-10 text-center">
                      <button 
                        className="text-text-muted hover:text-primary transition-colors cursor-pointer"
                        onClick={toggleSelectAll}
                      >
                        {selectedRows.size === orders.length && orders.length > 0 ? (
                          <CheckSquare size={16} className="text-primary" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                  )}
                  <th 
                    className="p-4 font-semibold text-text-secondary cursor-pointer hover:text-text-primary transition-colors"
                    onClick={() => handleSort('order_number')}
                  >
                    No. Nota
                  </th>
                  <th 
                    className="p-4 font-semibold text-text-secondary cursor-pointer hover:text-text-primary transition-colors"
                    onClick={() => handleSort('created_at')}
                  >
                    Waktu
                  </th>
                  <th className="p-4 font-semibold text-text-secondary">Pelanggan</th>
                  <th className="p-4 font-semibold text-text-secondary">Kasir</th>
                  <th 
                    className="p-4 font-semibold text-text-secondary cursor-pointer hover:text-text-primary transition-colors"
                    onClick={() => handleSort('total')}
                  >
                    Total
                  </th>
                  <th className="p-4 font-semibold text-text-secondary text-center">Bayar</th>
                  <th className="p-4 font-semibold text-text-secondary text-center">Status</th>
                  <th className="p-4 font-semibold text-text-secondary text-right">Aksi</th>
                </tr>
              </thead>
              <tbody ref={tableRef} className="divide-y divide-border-subtle">
                
                {loading ? (
                  // Skeleton loader rows
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse bg-surface">
                      {user?.role === 'owner' && <td className="p-4"><div className="w-4 h-4 bg-surface-2 rounded"></div></td>}
                      <td className="p-4"><div className="w-24 h-4 bg-surface-2 rounded"></div></td>
                      <td className="p-4"><div className="w-16 h-4 bg-surface-2 rounded"></div></td>
                      <td className="p-4"><div className="w-20 h-4 bg-surface-2 rounded"></div></td>
                      <td className="p-4"><div className="w-16 h-4 bg-surface-2 rounded"></div></td>
                      <td className="p-4"><div className="w-20 h-4 bg-surface-2 rounded"></div></td>
                      <td className="p-4"><div className="w-12 h-4 mx-auto bg-surface-2 rounded"></div></td>
                      <td className="p-4"><div className="w-16 h-4 mx-auto bg-surface-2 rounded"></div></td>
                      <td className="p-4"><div className="w-16 h-7 ml-auto bg-surface-2 rounded"></div></td>
                    </tr>
                  ))
                ) : orders.length === 0 ? (
                  // Empty states based on search query values
                  <tr>
                    <td colSpan={user?.role === 'owner' ? 9 : 8} className="p-12 text-center text-text-muted bg-surface/50">
                      <div className="max-w-[280px] mx-auto flex flex-col items-center">
                        <AlertCircle className="text-text-muted mb-3" size={36} />
                        <p className="font-semibold text-text-primary text-base">Tidak Ada Transaksi</p>
                        <p className="text-xs text-text-secondary mt-1">
                          {debouncedSearch 
                            ? 'Hasil pencarian nota atau nama pelanggan tidak ditemukan.' 
                            : 'Tidak ada transaksi tercatat untuk filter periode yang dipilih.'}
                        </p>
                        <button 
                          className="mt-4 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-text-primary text-xs rounded-lg transition-colors border border-border"
                          onClick={handleResetFilters}
                        >
                          Reset Filter
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  // Active Rows mapping
                  orders.map((o) => {
                    const isSelected = selectedOrderId === o.id;
                    const isRowChecked = selectedRows.has(o.id);
                    return (
                      <tr 
                        key={o.id} 
                        className={`transition-colors border-b border-border-subtle hover:bg-white/5 cursor-pointer ${
                          isSelected ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => handleOpenOrder(o.id)}
                      >
                        {user?.role === 'owner' && (
                          <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button 
                              className="text-text-muted hover:text-primary transition-colors cursor-pointer"
                              onClick={() => toggleRow(o.id)}
                            >
                              {isRowChecked ? (
                                <CheckSquare size={16} className="text-primary" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          </td>
                        )}
                        <td className="p-4 font-semibold text-text-primary">
                          {o.order_number}
                        </td>
                        <td className="p-4 text-text-secondary text-xs">
                          {o.created_at ? new Date(o.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="p-4 text-text-secondary font-medium text-xs max-w-[120px] truncate">
                          {o.customer_name || <span className="italic text-text-muted">Walk-in</span>}
                        </td>
                        <td className="p-4 text-text-secondary text-xs truncate max-w-[100px]">
                          {o.cashier_name || <span className="text-text-muted">-</span>}
                        </td>
                        <td className="p-4 font-bold text-text-primary">
                          {formatRupiah(o.net_total)}
                          {o.refunded_amount > 0 && (
                            <span className="block text-[10px] text-text-muted line-through font-normal">
                              {formatRupiah(o.total)}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center text-text-secondary uppercase text-xs font-semibold">
                          {o.payment_method}
                        </td>
                        <td className="p-4 text-center">
                          {renderStatusBadge(o.status)}
                          
                          {/* Sync / Audit badges */}
                          <div className="flex justify-center gap-1.5 mt-1">
                            {o.is_reviewed && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Locked & Reviewed" />
                            )}
                            {o.id < 0 ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Offline Sync Pending" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-success" title="Synced to Cloud" />
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-transparent text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors text-xs font-semibold cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenOrder(o.id);
                            }}
                          >
                            <Eye size={14} /> Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
                
              </tbody>
            </table>
          </div>

        </div>

        {/* Transaction Detail Drawer (Right slide overlay container) */}
        <div ref={drawerRef}>
          {selectedOrderId && (
            <div className="w-full lg:w-[450px] bg-surface-2 border border-border lg:rounded-xl shadow-lg flex flex-col h-[calc(100vh-140px)] sticky top-[80px] overflow-hidden animate-slide-in">
              
              {/* Drawer Header */}
              <div className="p-4 border-b border-border bg-surface flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button 
                    className="p-1.5 hover:bg-surface-2 rounded-lg text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                    onClick={handleCloseDrawer}
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <h2 className="font-bold text-text-primary text-base">
                      Detail Nota {selectedOrder ? selectedOrder.order_number : '...'}
                    </h2>
                    <span className="text-[11px] text-text-secondary block mt-0.5">
                      {selectedOrder?.created_at ? new Date(selectedOrder.created_at).toLocaleString('id-ID') : ''}
                    </span>
                  </div>
                </div>
                
                {/* Audit & Reviewed Lock Indicator Badge */}
                {selectedOrder?.is_reviewed && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[10px] font-bold rounded-md">
                    <Lock size={10} /> Locked
                  </span>
                )}
              </div>

              {/* Drawer Scrollable Body Content */}
              {selectedOrder ? (
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6">
                  
                  {/* Shift Information panel */}
                  <div className="p-3.5 bg-surface-2 border border-border rounded-xl text-xs space-y-3">
                    <div className="flex items-center justify-between text-text-secondary border-b border-border-subtle pb-2">
                      <span className="font-bold text-text-primary uppercase tracking-wider text-[10px]">Detail Shift</span>
                      <span className="font-mono text-primary font-bold text-xs bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{selectedOrder.shift_number || 'KopiPOS Shift'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-text-secondary">
                      <div className="space-y-0.5">
                        <span className="block text-[9px] font-bold text-text-muted uppercase tracking-wider">Operator Kasir</span>
                        <span className="font-semibold text-text-primary block truncate">{selectedOrder.cashier_name || 'System / Auto'}</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="block text-[9px] font-bold text-text-muted uppercase tracking-wider">Tanggal Shift</span>
                        <span className="font-semibold text-text-primary block">
                          {selectedOrder.shift_started_at ? new Date(selectedOrder.shift_started_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="block text-[9px] font-bold text-text-muted uppercase tracking-wider">Buka Shift</span>
                        <div className="mt-0.5">
                          <span className="inline-flex items-center gap-1 font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded border border-success/20 font-mono text-[10px]">
                            <span className="w-1 h-1 rounded-full bg-success animate-pulse" />
                            {selectedOrder.shift_started_at ? new Date(selectedOrder.shift_started_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <span className="block text-[9px] font-bold text-text-muted uppercase tracking-wider">Tutup Shift</span>
                        <div className="mt-0.5">
                          {selectedOrder.shift_ended_at ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-text-secondary bg-surface-3 px-1.5 py-0.5 rounded border border-border font-mono text-[10px]">
                              <span className="w-1 h-1 rounded-full bg-text-muted" />
                              {new Date(selectedOrder.shift_ended_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-warning bg-warning/10 px-1.5 py-0.5 rounded border border-warning/20 font-mono text-[9px] uppercase tracking-wider animate-pulse">
                              <span className="w-1 h-1 rounded-full bg-warning animate-ping" />
                              Aktif
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items purchased receipt print-style view */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Item Pembelian</h3>
                    <div className="border border-dashed border-border rounded-xl p-3 bg-surface space-y-3 font-mono text-xs">
                      {selectedOrder.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-start">
                          <div>
                            <span className="font-semibold text-text-primary block">{item.product_name}</span>
                            <span className="text-[10px] text-text-secondary block mt-0.5">
                              {item.quantity}x {formatRupiah(item.unit_price)}
                              {item.variant_name && ` • Varian: ${item.variant_name}`}
                              {item.modifier_names && ` • Extra: ${item.modifier_names}`}
                            </span>
                          </div>
                          <span className="font-bold text-text-primary">{formatRupiah(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Milestone Audit Event Timelines */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Timeline Transaksi</h3>
                    <div className="relative pl-6 border-l-2 border-dashed border-border space-y-5 py-1">
                      
                      {/* Mapping audit logs returned from server */}
                      {selectedOrder.audit_logs && selectedOrder.audit_logs.length > 0 ? (
                        selectedOrder.audit_logs.map((log) => {
                          const eventColors = {
                            created: 'bg-info border-surface-2',
                            payment_success: 'bg-success border-surface-2',
                            refunded: 'bg-warning border-surface-2',
                            voided: 'bg-danger border-surface-2',
                            reviewed: 'bg-blue-500 border-surface-2'
                          };
                          const color = eventColors[log.event] || 'bg-text-secondary border-surface-2';
                          return (
                            <div key={log.id} className="relative">
                              <span className={`absolute -left-[31px] top-0 w-3.5 h-3.5 rounded-full border-4 ${color}`} />
                              <div className="text-xs font-bold text-text-primary uppercase tracking-wide">
                                {log.event.replace('_', ' ')}
                              </div>
                              <p className="text-[11px] text-text-secondary mt-0.5">{log.details}</p>
                              <span className="text-[9px] text-text-muted block mt-1 font-mono">
                                {new Date(log.created_at).toLocaleString('id-ID')}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        // Fallback logs path
                        <>
                          <div className="relative">
                            <span className="absolute -left-[31px] top-0 w-3.5 h-3.5 rounded-full bg-success border-4 border-surface-2" />
                            <div className="text-xs font-bold text-text-primary uppercase tracking-wide">Order Created</div>
                            <span className="text-[9px] text-text-muted block mt-0.5 font-mono">
                              {new Date(selectedOrder.created_at).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="relative">
                            <span className="absolute -left-[31px] top-0 w-3.5 h-3.5 rounded-full bg-success border-4 border-surface-2" />
                            <div className="text-xs font-bold text-text-primary uppercase tracking-wide">Payment Success</div>
                            <span className="text-[9px] text-text-muted block mt-0.5 font-mono">
                              {new Date(selectedOrder.created_at).toLocaleString('id-ID')}
                            </span>
                          </div>
                        </>
                      )}

                    </div>
                  </div>

                  {/* Notes / Special descriptions */}
                  {selectedOrder.notes && (
                    <div className="p-3 bg-surface border border-border rounded-xl">
                      <span className="block text-[10px] text-text-muted font-bold uppercase mb-1">Catatan Nota</span>
                      <p className="text-xs text-text-primary italic">"{selectedOrder.notes}"</p>
                    </div>
                  )}

                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-text-muted">
                  <Loader className="animate-spin text-primary mb-3" size={24} />
                  <span>Memuat detail order...</span>
                </div>
              )}

              {/* Drawer Footer (Sticky Calculations & Action Buttons) */}
              {selectedOrder && (
                <div className="p-4 bg-surface border-t border-border space-y-4 shadow-lg-up">
                  
                  {/* Calculation rows */}
                  <div className="text-xs space-y-1.5 font-mono text-text-secondary border-b border-border pb-3">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{formatRupiah(selectedOrder.subtotal)}</span>
                    </div>
                    {selectedOrder.discount > 0 && (
                      <div className="flex justify-between text-danger">
                        <span>Diskon</span>
                        <span>-{formatRupiah(selectedOrder.discount)}</span>
                      </div>
                    )}
                    {selectedOrder.refunded_amount > 0 && (
                      <div className="flex justify-between text-warning">
                        <span>Total Refunded</span>
                        <span>-{formatRupiah(selectedOrder.refunded_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-text-primary pt-1 border-t border-dashed border-border">
                      <span>NET TOTAL</span>
                      <span>{formatRupiah(selectedOrder.net_total)}</span>
                    </div>
                  </div>

                  {/* Diagnostic WebSockets Print status */}
                  <div className="flex items-center justify-between text-[11px] text-text-secondary px-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        qzStatus === 'connected' ? 'bg-success' : qzStatus === 'connecting' ? 'bg-warning animate-pulse' : 'bg-danger'
                      }`} />
                      <span>QZ Print Server Status</span>
                    </div>
                    {qzStatus === 'error' && (
                      <button 
                        className="text-primary hover:underline font-semibold"
                        onClick={handleConnectQZ}
                      >
                        Re-connect
                      </button>
                    )}
                  </div>

                  {/* Primary Print / Action routes */}
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      className="px-2 py-2 text-xs font-semibold bg-surface border border-border text-text-primary rounded-lg hover:bg-surface-3 transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                      onClick={handleQZPrint}
                      disabled={printing || selectedOrder.is_reviewed}
                      title="Cetak via QZ Tray local socket"
                    >
                      <Printer size={16} />
                      <span>QZ Tray</span>
                    </button>
                    <button 
                      className="px-2 py-2 text-xs font-semibold bg-surface border border-border text-text-primary rounded-lg hover:bg-surface-3 transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                      onClick={handleNetworkPrint}
                      disabled={networkPrinting || selectedOrder.is_reviewed}
                      title="Cetak via LAN IP Backend"
                    >
                      <Wifi size={16} />
                      <span>Network</span>
                    </button>
                    <button 
                      className="px-2 py-2 text-xs font-semibold bg-surface border border-border text-text-primary rounded-lg hover:bg-surface-3 transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer"
                      onClick={() => window.print()}
                      title="Cetak via browser PDF"
                    >
                      <Monitor size={16} />
                      <span>Browser</span>
                    </button>
                  </div>

                  {/* Void & Refund controls (FE locks applied based on status matrix rules) */}
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      className="w-full px-4 py-2.5 bg-danger text-white rounded-lg text-sm font-bold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      onClick={handleOpenVoidFlow}
                      disabled={
                        selectedOrder.status === 'voided' || 
                        selectedOrder.refunded_amount > 0 || 
                        selectedOrder.is_reviewed
                      }
                      title="Void order (Hanya bisa sebelum shift settle)"
                    >
                      <Trash2 size={16} /> Void
                    </button>
                    <button 
                      className="w-full px-4 py-2.5 bg-warning text-text-inverse rounded-lg text-sm font-bold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      onClick={handleOpenRefundFlow}
                      disabled={
                        selectedOrder.status === 'voided' || 
                        selectedOrder.status === 'refunded' || 
                        selectedOrder.is_reviewed
                      }
                      title="Refund order (Itemized partial/full return)"
                    >
                      <Undo2 size={16} /> Refund
                    </button>
                  </div>

                </div>
              )}

            </div>
          )}
        </div>

      </div>

      {/* Floating Bulk Action Toolbar (Owner only select actions) */}
      {user?.role === 'owner' && selectedRows.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface border border-primary/30 p-4 rounded-xl shadow-lg flex items-center gap-4 z-40 animate-slide-up bg-glass backdrop-blur-md">
          <span className="text-sm text-text-primary font-semibold">
            {selectedRows.size} transaksi terpilih
          </span>
          <div className="h-4 w-px bg-border" />
          <div className="flex gap-2">
            <button 
              className="px-3.5 py-1.5 bg-surface-2 text-text-primary border border-border text-xs font-semibold rounded-lg hover:bg-surface-3 transition-colors cursor-pointer"
              onClick={handleBulkExportCSV}
            >
              Export CSV
            </button>
            <button 
              className="px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-dark transition-colors cursor-pointer flex items-center gap-1.5"
              onClick={handleBulkReview}
            >
              <Lock size={12} /> Tinjau & Kunci
            </button>
            <button 
              className="px-2.5 py-1.5 bg-surface-2 text-text-muted hover:text-text-primary transition-colors text-xs font-semibold rounded-lg cursor-pointer"
              onClick={() => setSelectedRows(new Set())}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Supervisor PIN Pad Otorisasi */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-2 border border-border rounded-2xl w-[320px] overflow-hidden shadow-lg p-5 space-y-4">
            
            <div className="text-center">
              <Lock className="mx-auto text-warning mb-2" size={32} />
              <h3 className="font-bold text-text-primary text-base">Otorisasi Supervisor</h3>
              <p className="text-xs text-text-secondary mt-1">
                Tindakan {pinActionType.toUpperCase()} memerlukan izin Supervisor / Owner
              </p>
            </div>

            {/* Hidden Input field for PIN */}
            <div className="flex justify-center gap-2 py-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div 
                  key={idx} 
                  className={`w-10 h-12 border-2 rounded-lg flex items-center justify-center font-bold text-lg ${
                    supervisorPin.length > idx ? 'border-primary bg-primary/10 text-text-primary' : 'border-border bg-surface'
                  }`}
                >
                  {supervisorPin.length > idx ? '•' : ''}
                </div>
              ))}
            </div>

            {/* Custom On-screen keypad for touchscreen POS */}
            <div className="grid grid-cols-3 gap-2 text-sm font-semibold">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button 
                  key={num}
                  className="py-3 bg-surface rounded-lg hover:bg-surface-3 active:scale-95 transition-all text-text-primary cursor-pointer text-center"
                  onClick={() => supervisorPin.length < 4 && setSupervisorPin(prev => prev + num)}
                >
                  {num}
                </button>
              ))}
              <button 
                className="py-3 bg-surface-3 rounded-lg hover:bg-surface-2 active:scale-95 transition-all text-text-secondary cursor-pointer text-center"
                onClick={() => setSupervisorPin('')}
              >
                Clear
              </button>
              <button 
                className="py-3 bg-surface rounded-lg hover:bg-surface-3 active:scale-95 transition-all text-text-primary cursor-pointer text-center"
                onClick={() => supervisorPin.length < 4 && setSupervisorPin(prev => prev + '0')}
              >
                0
              </button>
              <button 
                className="py-3 bg-surface-3 rounded-lg hover:bg-surface-2 active:scale-95 transition-all text-text-secondary cursor-pointer text-center"
                onClick={() => supervisorPin.length > 0 && setSupervisorPin(prev => prev.slice(0, -1))}
              >
                Del
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                className="flex-1 py-2 bg-surface-3 text-text-secondary rounded-lg text-xs font-semibold hover:bg-surface border border-border cursor-pointer"
                onClick={() => setShowPinModal(false)}
              >
                Kembali
              </button>
              <button 
                className="flex-1 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-dark transition-colors cursor-pointer"
                onClick={handleVerifyPin}
                disabled={supervisorPin.length < 4}
              >
                Otorisasi
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: Void Confirmation Form */}
      {showVoidModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-2 border border-border rounded-2xl w-[400px] overflow-hidden shadow-lg p-5 space-y-4 animate-scale-up">
            
            <div className="flex items-center gap-3 text-danger border-b border-border pb-3">
              <AlertCircle size={24} />
              <h3 className="font-bold text-text-primary text-base">Konfirmasi Void Order</h3>
            </div>

            <div className="text-xs text-text-secondary space-y-1">
              <p>Anda akan melakukan pembatalan nota: <span className="font-semibold text-text-primary">{selectedOrder.order_number}</span></p>
              <p className="text-danger font-semibold">Tindakan ini tidak dapat dibatalkan.</p>
            </div>

            {/* Mandatory void reason select */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-text-secondary">Alasan Void (Wajib)</label>
              <select 
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary text-sm focus:border-danger outline-none"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
              >
                <option value="Accidental Double Charge">Kesalahan Entri Kasir (Double Input)</option>
                <option value="Wrong Item Prepared">Kitchen Salah Bikin / Batalkan Pesanan</option>
                <option value="Customer Cancelled Order">Pelanggan Mengurungkan Pembelian</option>
                <option value="Quality Issue">Masalah Kualitas Sajian</option>
                <option value="Other">Lainnya (Tulis Catatan)</option>
              </select>
            </div>

            {/* Text description */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-text-secondary">Catatan Tambahan</label>
              <textarea 
                rows={2}
                placeholder="Masukkan keterangan tambahan jika ada..."
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary text-sm focus:border-danger outline-none resize-none font-sans"
                value={voidNotes}
                onChange={(e) => setVoidNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <button 
                className="flex-1 py-2 bg-surface-3 text-text-secondary rounded-lg text-xs font-semibold hover:bg-surface border border-border cursor-pointer"
                onClick={() => setShowVoidModal(false)}
              >
                Batal
              </button>
              <button 
                className="flex-1 py-2 bg-danger text-white rounded-lg text-xs font-bold hover:bg-danger-hover transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                onClick={handleSubmitVoid}
                disabled={printing}
              >
                {printing ? <Loader className="animate-spin" size={14} /> : null}
                Konfirmasi Void
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: Itemized Refund Options Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-2 border border-border rounded-2xl w-[450px] overflow-hidden shadow-lg p-5 space-y-4 animate-scale-up">
            
            <div className="flex items-center gap-3 text-warning border-b border-border pb-3">
              <Undo2 size={24} />
              <h3 className="font-bold text-text-primary text-base">Refund Item Transaksi</h3>
            </div>

            {/* Item lists quantity controllers */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-text-secondary">Pilih Item & Kuantitas Refund</label>
              <div className="border border-border rounded-xl divide-y divide-border overflow-hidden bg-surface max-h-[180px] overflow-y-auto custom-scrollbar">
                {selectedOrder.items.map(item => {
                  
                  // Calculate remaining returnable qty for this row item
                  let returned = 0;
                  selectedOrder.refunds.forEach(ref => {
                    ref.items.forEach(refItem => {
                      if (refItem.order_item_id === item.id) {
                        returned += refItem.quantity;
                      }
                    });
                  });
                  const maxReturnable = item.quantity - returned;
                  const currentRefundQty = refundItems[item.id] || 0;

                  if (maxReturnable <= 0) return null;

                  return (
                    <div key={item.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-text-primary block">{item.product_name}</span>
                        <span className="text-[10px] text-text-secondary">Max bisa direfund: {maxReturnable}</span>
                      </div>
                      
                      {/* Quantity counters */}
                      <div className="flex items-center gap-2">
                        <button 
                          className="w-7 h-7 bg-surface-2 hover:bg-surface-3 rounded-lg flex items-center justify-center font-bold text-text-primary border border-border cursor-pointer"
                          onClick={() => setRefundItems(prev => ({
                            ...prev,
                            [item.id]: Math.max(currentRefundQty - 1, 0)
                          }))}
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-mono font-bold text-text-primary">
                          {currentRefundQty}
                        </span>
                        <button 
                          className="w-7 h-7 bg-surface-2 hover:bg-surface-3 rounded-lg flex items-center justify-center font-bold text-text-primary border border-border cursor-pointer"
                          onClick={() => setRefundItems(prev => ({
                            ...prev,
                            [item.id]: Math.min(currentRefundQty + 1, maxReturnable)
                          }))}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Calculations widget showing preview total */}
            <div className="p-3 bg-surface border border-border rounded-xl text-xs font-mono space-y-1">
              <div className="flex justify-between text-text-secondary">
                <span>Subtotal Kembali</span>
                <span>{formatRupiah(calculateRefundModalTotals().subtotal)}</span>
              </div>
              {selectedOrder.discount > 0 && (
                <div className="flex justify-between text-danger">
                  <span>Pro-rated Diskon</span>
                  <span>-{formatRupiah(calculateRefundModalTotals().discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-text-primary pt-1 border-t border-dashed border-border text-sm">
                <span>ESTIMASI DANA KEMBALI</span>
                <span>{formatRupiah(calculateRefundModalTotals().total)}</span>
              </div>
            </div>

            {/* Form details input */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-text-secondary">Refund Method</label>
                <select 
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary text-xs focus:border-primary outline-none"
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
                >
                  <option value="cash">Cash (Uang Tunai)</option>
                  <option value="qris">QRIS Reversal</option>
                  <option value="voucher">Voucher Kredit Toko</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-text-secondary">Alasan Refund (Wajib)</label>
                <select 
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary text-xs focus:border-primary outline-none"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                >
                  <option value="Wrong Item Prepared">Salah Sajian / Kitchen Error</option>
                  <option value="Quality Issue">Kualitas Rendah (Hambar/Dingin)</option>
                  <option value="Accidental Double Charge">Kesalahan Tagih Kasir</option>
                  <option value="Customer Changed Mind">Pelanggan Batal Beli</option>
                  <option value="Other">Lainnya (Tulis Notes)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-text-secondary">Keterangan Refund</label>
              <textarea 
                rows={2}
                placeholder="Masukkan catatan alasan refund item jika ada..."
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-primary text-xs focus:border-primary outline-none resize-none font-sans"
                value={refundNotes}
                onChange={(e) => setRefundNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <button 
                className="flex-1 py-2 bg-surface-3 text-text-secondary rounded-lg text-xs font-semibold hover:bg-surface border border-border cursor-pointer"
                onClick={() => setShowRefundModal(false)}
              >
                Batal
              </button>
              <button 
                className="flex-1 py-2 bg-warning text-text-inverse rounded-lg text-xs font-bold hover:bg-warning-hover transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                onClick={handleSubmitRefund}
                disabled={printing}
              >
                {printing ? <Loader className="animate-spin" size={14} /> : null}
                Konfirmasi Refund
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: Keyboard shortcuts mappings overlay */}
      {showShortcutsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-2 border border-border rounded-2xl w-[360px] overflow-hidden shadow-lg p-5 space-y-4">
            
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <HelpCircle size={20} className="text-primary" />
              <h3 className="font-bold text-text-primary text-base">Shortcut Keyboard POS</h3>
            </div>

            <div className="space-y-2.5 text-xs text-text-secondary">
              <div className="flex justify-between items-center">
                <span>Fokus Cari / Scan Barcode</span>
                <kbd className="px-2 py-1 bg-surface border border-border rounded text-[10px] font-mono text-text-primary">F</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Cetak Nota Terbuka</span>
                <kbd className="px-2 py-1 bg-surface border border-border rounded text-[10px] font-mono text-text-primary">P</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Refund Transaksi Terbuka</span>
                <kbd className="px-2 py-1 bg-surface border border-border rounded text-[10px] font-mono text-text-primary">R</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Void Transaksi Terbuka</span>
                <kbd className="px-2 py-1 bg-surface border border-border rounded text-[10px] font-mono text-text-primary">V</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Tutup Drawer / Modal</span>
                <kbd className="px-2 py-1 bg-surface border border-border rounded text-[10px] font-mono text-text-primary">ESC</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Buka Shortcut Overlay</span>
                <kbd className="px-2 py-1 bg-surface border border-border rounded text-[10px] font-mono text-text-primary">?</kbd>
              </div>
            </div>

            <button 
              className="w-full py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-dark transition-colors cursor-pointer"
              onClick={() => setShowShortcutsModal(false)}
            >
              Tutup
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
