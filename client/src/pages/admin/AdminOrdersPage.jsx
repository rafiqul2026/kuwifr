// client/src/pages/admin/AdminOrdersPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminOrdersPage.module.css';

const STATUS_OPTIONS = [
  'ALL',
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED'
];

const DEFAULT_PAGINATION = {
  page: 1,
  limit: 20,
  total: 0,
  pages: 1
};

const AdminOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierPartner, setCourierPartner] = useState('');
  const { showNotification } = useNotification();

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(pagination.page || 1),
        limit: String(pagination.limit || 20),
        ...(filterStatus !== 'ALL' && { status: filterStatus }),
        ...(searchQuery.trim() && { search: searchQuery.trim() })
      });

      let res;
      try {
        res = await api.get(`/api/admin/orders?${params}`);
      } catch {
        res = await api.get(`/api/orders?${params}`);
      }

      if (res.data?.success || Array.isArray(res.data)) {
        const orderList = res.data?.data?.orders || res.data?.orders || (Array.isArray(res.data) ? res.data : []);
        setOrders(Array.isArray(orderList) ? orderList : []);

        const pageInfo = res.data?.data?.pagination || res.data?.pagination;
        if (pageInfo && typeof pageInfo.pages === 'number') {
          setPagination(pageInfo);
        } else {
          setPagination({
            page: 1,
            limit: 20,
            total: orderList.length,
            pages: 1
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      showNotification('Unable to fetch live orders.', 'error');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filterStatus, searchQuery, showNotification]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const kpis = useMemo(() => {
    const total = orders.length;
    const revenue = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const delivered = orders.filter((o) => (o.orderStatus || '').toUpperCase() === 'DELIVERED').length;
    const pending = orders.filter((o) => {
      const st = (o.orderStatus || '').toUpperCase();
      return st === 'PROCESSING' || st === 'PAID' || st === 'PENDING';
    }).length;
    return { total, revenue, delivered, pending };
  }, [orders]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      setUpdatingId(orderId);
      const payload = {
        status: newStatus,
        orderStatus: newStatus,
        trackingNumber,
        courierPartner
      };

      try {
        await api.put(`/api/admin/orders/${orderId}/status`, payload);
      } catch {
        await api.put(`/api/orders/${orderId}/status`, payload);
      }

      showNotification(`Order status updated to ${newStatus}`, 'success');
      setShowDetails(false);
      fetchOrders();
    } catch (error) {
      console.error('Update status error:', error);
      showNotification('Failed to update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleViewDetails = (order) => {
    setSelectedOrder(order);
    setTrackingNumber(order.trackingNumber || '');
    setCourierPartner(order.courierPartner || 'Delhivery');
    setShowDetails(true);
  };

  const getStatusBadgeClass = (status) => {
    switch ((status || '').toUpperCase()) {
      case 'DELIVERED':
      case 'PAID':
        return styles.badgeGreen;
      case 'SHIPPED':
      case 'PROCESSING':
        return styles.badgeBlue;
      case 'CANCELLED':
      case 'REFUNDED':
        return styles.badgeRed;
      default:
        return styles.badgeAmber;
    }
  };

  return (
    <div className={styles.ordersPage}>
      {/* 1. Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.statusPill}>
            <span className={styles.pulseDot}></span>
            <span>Live Fulfillment Pipeline</span>
          </div>
          <h1 className={styles.title}>Order Management</h1>
          <p className={styles.subtitle}>
            Monitor member orders, package activations, shipments, and dispatch tracking.
          </p>
        </div>

        <button onClick={fetchOrders} className={styles.refreshBtn}>
          ↻ Refresh Orders
        </button>
      </div>

      {/* 2. KPI Metrics Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Orders</span>
          <strong className={styles.statValue}>{kpis.total}</strong>
          <span className={styles.statHelp}>All-time recorded orders</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Gross Sales Value</span>
          <strong className={`${styles.statValue} ${styles.greenText}`}>
            ₹{kpis.revenue.toLocaleString('en-IN')}
          </strong>
          <span className={styles.statHelp}>Total transaction volume</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pending Dispatch</span>
          <strong className={`${styles.statValue} ${kpis.pending > 0 ? styles.amberText : ''}`}>
            {kpis.pending}
          </strong>
          <span className={styles.statHelp}>Awaiting fulfillment</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Delivered Orders</span>
          <strong className={styles.statValue}>{kpis.delivered}</strong>
          <span className={styles.statHelp}>Completed shipments</span>
        </div>
      </div>

      {/* 3. Search and Status Filter */}
      <div className={styles.filterStrip}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search by Order ID, Customer Name, Tracking #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className={styles.clearSearch}>✕</button>
          )}
        </div>

        <div className={styles.statusPillsRow}>
          {STATUS_OPTIONS.map((st) => (
            <button
              key={st}
              onClick={() => {
                setFilterStatus(st);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className={`${styles.filterPill} ${filterStatus === st ? styles.filterPillActive : ''}`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Table Wrapper */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Syncing orders database...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📦</span>
            <h3>No orders found</h3>
            <p>No orders match the current filter selection.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ORDER ID</th>
                <th>CUSTOMER</th>
                <th>PLAN / ITEMS</th>
                <th>AMOUNT</th>
                <th>KBP</th>
                <th>STATUS</th>
                <th>TRACKING</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const id = order._id || order.id;
                const status = (order.orderStatus || order.status || 'PROCESSING').toUpperCase();
                const customer = order.customerName || order.userId?.fullName || 'Direct Member';
                const contact = order.customerPhone || order.userId?.phoneNumber || order.customerEmail || order.userId?.email || '';

                return (
                  <tr key={id}>
                    <td>
                      <strong className={styles.orderNumber}>
                        {order.orderNumber || `KWF-${id.slice(-6)}`}
                      </strong>
                      <span className={styles.orderDate}>
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : 'Recent'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.customerMeta}>
                        <span className={styles.customerName}>{customer}</span>
                        <span className={styles.customerSub}>{contact}</span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.packageTag}>
                        {order.packageName || `${(order.products || order.items || []).length || 1} Item(s)`}
                      </span>
                    </td>
                    <td>
                      <strong className={styles.amountText}>
                        ₹{Number(order.totalAmount || 0).toLocaleString('en-IN')}
                      </strong>
                      <span className={styles.paymentMethod}>
                        {order.paymentMethod || order.paymentType || 'UPI'}
                      </span>
                    </td>
                    <td>
                      <span className={styles.kbpBadge}>
                        ⭐ {Number(order.kbpGenerated || order.totalKBP || 0).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${getStatusBadgeClass(status)}`}>
                        {status}
                      </span>
                    </td>
                    <td>
                      {order.trackingNumber ? (
                        <div className={styles.trackingMeta}>
                          <code>{order.trackingNumber}</code>
                          <small>{order.courierPartner || 'Delhivery'}</small>
                        </div>
                      ) : (
                        <span className={styles.noTracking}>Pending Assignment</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className={styles.viewBtn}
                        onClick={() => handleViewDetails(order)}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Controls */}
      <div className={styles.pagination}>
        <button
          disabled={pagination.page <= 1}
          onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
        >
          Previous
        </button>
        <span>
          Page {pagination.page || 1} of {pagination.pages || 1} ({pagination.total || orders.length} Total Orders)
        </span>
        <button
          disabled={pagination.page >= pagination.pages}
          onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
        >
          Next
        </button>
      </div>

      {/* 5. Order Management Modal */}
      {showDetails && selectedOrder && (
        <div className={styles.modalOverlay} onClick={() => setShowDetails(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Order {selectedOrder.orderNumber}</h2>
                <p className={styles.modalSub}>Update courier tracking and delivery progression.</p>
              </div>
              <button className={styles.closeModalBtn} onClick={() => setShowDetails(false)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.detailsGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Member / Customer</span>
                  <span className={styles.detailValue}>
                    {selectedOrder.customerName || selectedOrder.userId?.fullName || 'N/A'}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Email / Phone</span>
                  <span className={styles.detailValue}>
                    {selectedOrder.customerPhone || selectedOrder.userId?.phoneNumber || selectedOrder.customerEmail || selectedOrder.userId?.email || 'N/A'}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Order Total</span>
                  <strong className={styles.detailPrice}>
                    ₹{Number(selectedOrder.totalAmount || 0).toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Binary Volume</span>
                  <span className={styles.detailValue}>
                    ⭐ {selectedOrder.kbpGenerated || selectedOrder.totalKBP || 0} KBP
                  </span>
                </div>
                <div className={`${styles.detailItem} ${styles.colSpan2}`}>
                  <span className={styles.detailLabel}>Delivery Address</span>
                  <span className={styles.detailValue}>
                    {selectedOrder.deliveryAddress?.addressLine1 || selectedOrder.shippingAddress?.street || 'GS Road'},{' '}
                    {selectedOrder.deliveryAddress?.city || selectedOrder.shippingAddress?.city || 'Guwahati'},{' '}
                    {selectedOrder.deliveryAddress?.state || selectedOrder.shippingAddress?.state || 'Assam'} -{' '}
                    {selectedOrder.deliveryAddress?.pincode || selectedOrder.shippingAddress?.pincode || '781005'}
                  </span>
                </div>
              </div>

              {/* Courier Tracking Inputs */}
              <div className={styles.courierSection}>
                <h4>Fulfillment Tracking</h4>
                <div className={styles.courierInputs}>
                  <input
                    type="text"
                    placeholder="Courier Partner (e.g. BlueDart, Delhivery)"
                    value={courierPartner}
                    onChange={(e) => setCourierPartner(e.target.value)}
                    className={styles.modalInput}
                  />
                  <input
                    type="text"
                    placeholder="Tracking AWB / Number"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className={styles.modalInput}
                  />
                </div>
              </div>

              {/* Transition Status Buttons */}
              <div className={styles.statusActionSection}>
                <h4>Transition Order Status</h4>
                <div className={styles.statusButtonsGroup}>
                  {['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((st) => (
                    <button
                      key={st}
                      disabled={updatingId === selectedOrder._id}
                      onClick={() => handleStatusUpdate(selectedOrder._id || selectedOrder.id, st)}
                      className={`${styles.statusActionButton} ${styles[`btn_${st.toLowerCase()}`]}`}
                    >
                      Set {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrdersPage;