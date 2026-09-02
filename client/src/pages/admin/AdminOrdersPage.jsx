import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminOrdersPage.module.css';

const AdminOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchOrders();
  }, [pagination.page, filterStatus]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(filterStatus !== 'ALL' && { status: filterStatus })
      });
      
      const response = await api.get(`/api/admin/orders?${params}`);
      if (response.data.success) {
        setOrders(response.data.data.orders || []);
        setPagination(response.data.data.pagination);
      }
    } catch (error) {
      showNotification('Failed to fetch orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId, status) => {
    try {
      await api.put(`/api/admin/orders/${orderId}/status`, { status });
      showNotification(`Order status updated to ${status}`, 'success');
      fetchOrders();
    } catch (error) {
      showNotification('Failed to update order status', 'error');
    }
  };

  const handleViewDetails = async (orderId) => {
    try {
      const response = await api.get(`/api/admin/orders/${orderId}`);
      if (response.data.success) {
        setSelectedOrder(response.data.data.order);
        setShowDetails(true);
      }
    } catch (error) {
      showNotification('Failed to fetch order details', 'error');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'PENDING': '#f59e0b',
      'PAID': '#22c55e',
      'PROCESSING': '#3b82f6',
      'SHIPPED': '#8b5cf6',
      'DELIVERED': '#22c55e',
      'CANCELLED': '#ef4444',
      'REFUNDED': '#64748b'
    };
    return colors[status] || '#64748b';
  };

  const statusOptions = [
    'PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'
  ];

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading orders...</p>
      </div>
    );
  }

  return (
    <div className={styles.ordersPage}>
      <div className={styles.header}>
        <h1>Order Management</h1>
        <div className={styles.filters}>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">All Status</option>
            {statusOptions.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Member</th>
              <th>Package</th>
              <th>Amount</th>
              <th>KBP</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan="8" className={styles.emptyState}>No orders found</td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order._id}>
                  <td>{order.orderNumber}</td>
                  <td>{order.userId?.fullName || 'N/A'}</td>
                  <td>{order.packageName || 'N/A'}</td>
                  <td>₹{order.totalAmount?.toLocaleString()}</td>
                  <td>{order.kbpGenerated}</td>
                  <td>
                    <span 
                      className={styles.statusBadge}
                      style={{ background: getStatusColor(order.orderStatus) }}
                    >
                      {order.orderStatus}
                    </span>
                  </td>
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className={styles.actionButtons}>
                      <button 
                        className={styles.viewBtn}
                        onClick={() => handleViewDetails(order._id)}
                      >
                        View
                      </button>
                      <select
                        className={styles.statusSelect}
                        value={order.orderStatus}
                        onChange={(e) => handleStatusUpdate(order._id, e.target.value)}
                      >
                        {statusOptions.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <button
          disabled={pagination.page <= 1}
          onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
        >
          Previous
        </button>
        <span>Page {pagination.page} of {pagination.pages}</span>
        <button
          disabled={pagination.page >= pagination.pages}
          onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
        >
          Next
        </button>
      </div>

      {/* Order Details Modal */}
      {showDetails && selectedOrder && (
        <div className={styles.modalOverlay} onClick={() => setShowDetails(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Order Details - {selectedOrder.orderNumber}</h2>
              <button className={styles.closeModalBtn} onClick={() => setShowDetails(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.detailsGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Member</span>
                  <span className={styles.detailValue}>{selectedOrder.userId?.fullName}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Email</span>
                  <span className={styles.detailValue}>{selectedOrder.userId?.email}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Package</span>
                  <span className={styles.detailValue}>{selectedOrder.packageName}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Status</span>
                  <span 
                    className={styles.statusBadge}
                    style={{ background: getStatusColor(selectedOrder.orderStatus) }}
                  >
                    {selectedOrder.orderStatus}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Total Amount</span>
                  <span className={styles.detailValue}>₹{selectedOrder.totalAmount?.toLocaleString()}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>KBP Generated</span>
                  <span className={styles.detailValue}>{selectedOrder.kbpGenerated}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Payment Type</span>
                  <span className={styles.detailValue}>{selectedOrder.paymentType}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Payment Status</span>
                  <span className={styles.detailValue}>{selectedOrder.paymentStatus}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Order Date</span>
                  <span className={styles.detailValue}>
                    {new Date(selectedOrder.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Delivery Address</span>
                  <span className={styles.detailValue}>
                    {selectedOrder.deliveryAddress ? 
                      `${selectedOrder.deliveryAddress.addressLine1}, ${selectedOrder.deliveryAddress.city}, ${selectedOrder.deliveryAddress.state} - ${selectedOrder.deliveryAddress.pincode}` 
                      : 'N/A'}
                  </span>
                </div>
              </div>

              <div className={styles.productsSection}>
                <h3>Products</h3>
                <table className={styles.productTable}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>KBP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.products?.map((product, index) => (
                      <tr key={index}>
                        <td>{product.name}</td>
                        <td>{product.quantity}</td>
                        <td>₹{product.price}</td>
                        <td>{product.kbp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.statusHistory}>
                <h3>Status History</h3>
                <div className={styles.historyList}>
                  {selectedOrder.statusHistory?.map((history, index) => (
                    <div key={index} className={styles.historyItem}>
                      <span className={styles.historyStatus}>{history.status}</span>
                      <span className={styles.historyDate}>
                        {new Date(history.timestamp).toLocaleString()}
                      </span>
                      <span className={styles.historyNote}>{history.note}</span>
                    </div>
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