// client/src/pages/admin/AdminOrderDetailPage.jsx
//
// Full single-order detail view — this is what the Admin Dashboard's
// "Recent Orders" row previously pointed at (/admin/orders/:id) with no
// page registered for that route, so clicking a row silently redirected
// back to the dashboard. Backed by the existing GET /api/orders/:id
// endpoint (order.controller.js: getOrderById), which already returns the
// full order with its buyer populated — no new backend endpoint needed
// here, unlike the member detail page.
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminOrderDetailPage.module.css';

const STATUS_OPTIONS = ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const formatINR = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(val) || 0);

const formatDate = (val) => {
  if (!val) return '—';
  return new Date(val).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const AdminOrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification ? useNotification() : { showNotification: () => {} };

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierPartner, setCourierPartner] = useState('');

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      setNotFound(false);
      const res = await api.get(`/api/orders/${id}`);
      if (res.data?.success) {
        const o = res.data.data.order;
        setOrder(o);
        setTrackingNumber(o.trackingNumber || '');
        setCourierPartner(o.courierPartner || '');
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setNotFound(true);
      } else {
        console.error('Failed to load order:', err);
        showNotification('Failed to load order.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [id, showNotification]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleStatusUpdate = async (newStatus) => {
    setUpdating(true);
    try {
      const payload = { status: newStatus, orderStatus: newStatus, trackingNumber, courierPartner };
      try {
        await api.put(`/api/admin/orders/${id}/status`, payload);
      } catch {
        await api.put(`/api/orders/${id}/status`, payload);
      }
      setOrder((prev) => ({ ...prev, status: newStatus, orderStatus: newStatus, trackingNumber, courierPartner }));
      showNotification(`Order status updated to ${newStatus}.`, 'success');
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to update order status.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.detailPage}>
        <div className={styles.loadingWrapper}>
          <div className={styles.spinner} />
          <p>Loading order...</p>
        </div>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className={styles.detailPage}>
        <button type="button" className={styles.backBtn} onClick={() => navigate('/admin/orders')}>
          ← Back to Orders
        </button>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📦</span>
          <p>This order no longer exists, or the link is invalid.</p>
        </div>
      </div>
    );
  }

  const buyer = order.userId || {};
  const currentStatus = (order.status || order.orderStatus || 'PENDING').toUpperCase();
  const items = order.products || order.items || [];

  return (
    <div className={styles.detailPage}>
      <button type="button" className={styles.backBtn} onClick={() => navigate('/admin/orders')}>
        ← Back to Orders
      </button>

      <div className={styles.orderHeader}>
        <div>
          <h1 className={styles.orderTitle}>Order {order.orderNumber}</h1>
          <p className={styles.orderSubtitle}>
            Placed {formatDate(order.createdAt)} · {order.orderType || 'REPURCHASE'}
          </p>
        </div>
        <span className={`${styles.statusChip} ${styles['status_' + currentStatus] || ''}`}>{currentStatus}</span>
      </div>

      <div className={styles.statGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Amount</span>
          <strong className={styles.statValue}>{formatINR(order.totalAmount)}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>KBP Generated</span>
          <strong className={styles.statValue}>{(order.kbpGenerated || 0).toLocaleString('en-IN')}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Payment Type</span>
          <strong className={styles.statValue}>{order.paymentType || '—'}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Items</span>
          <strong className={styles.statValue}>{items.length || 1}</strong>
        </div>
      </div>

      <div className={styles.contentGrid}>
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Buyer</h3>
          <dl className={styles.detailList}>
            <div><dt>Name</dt><dd>{order.customerName || buyer.fullName || '—'}</dd></div>
            <div><dt>Member ID</dt><dd>{buyer.memberId || '—'}</dd></div>
            <div><dt>Email</dt><dd>{order.customerEmail || buyer.email || '—'}</dd></div>
            <div><dt>Phone</dt><dd>{order.customerPhone || buyer.phoneNumber || '—'}</dd></div>
          </dl>
          {buyer._id && (
            <button type="button" className={styles.linkBtn} onClick={() => navigate(`/admin/members/${buyer._id}`)}>
              View Member Profile →
            </button>
          )}
        </div>

        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Fulfillment</h3>
          <div className={styles.formRow}>
            <label>Courier Partner</label>
            <input type="text" value={courierPartner} onChange={(e) => setCourierPartner(e.target.value)} placeholder="e.g. Delhivery" />
          </div>
          <div className={styles.formRow}>
            <label>Tracking Number</label>
            <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Tracking #" />
          </div>
          <div className={styles.statusButtons}>
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={`${styles.statusBtn} ${s === currentStatus ? styles.statusBtnActive : ''}`}
                disabled={updating || s === currentStatus}
                onClick={() => handleStatusUpdate(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.panel}>
        <h3 className={styles.panelTitle}>Order Items</h3>
        {items.length > 0 ? (
          <table className={styles.miniTable}>
            <thead>
              <tr><th>Product</th><th>Qty</th><th>Price</th><th>KBP</th></tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it._id || idx}>
                  <td>{it.name || order.packageName || '—'}</td>
                  <td>{it.quantity || 1}</td>
                  <td>{formatINR(it.price)}</td>
                  <td>{(it.kbp || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={styles.dimText}>{order.packageName || 'No line items recorded.'}</p>
        )}
      </div>
    </div>
  );
};

export default AdminOrderDetailPage;
