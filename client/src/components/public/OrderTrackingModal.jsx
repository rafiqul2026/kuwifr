// client/src/components/public/OrderTrackingModal.jsx
import React, { useState } from 'react';
import styles from './OrderTrackingModal.module.css';

const OrderTrackingModal = ({ onClose }) => {
  const [orderId, setOrderId] = useState('');
  const [searched, setSearched] = useState(false);
  const [mockStatus, setMockStatus] = useState(null);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!orderId.trim()) return;

    // Simulate backend lookup
    setSearched(true);
    setMockStatus({
      orderNumber: orderId.toUpperCase(),
      date: '2026-08-28',
      status: 'PROCESSING',
      items: 'Kuwi Shilajit 99 (Qty: 1)',
      trackingNumber: 'DELHIVERY_998124901',
      steps: [
        { label: 'Order Placed & Verified', done: true },
        { label: 'Packed & In Warehouse', done: true },
        { label: 'Out for Delivery / Shipped', done: false },
        { label: 'Delivered', done: false },
      ]
    });
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
        <h3>Track Your KUWIFR Order</h3>
        <p className={styles.desc}>Enter your Order ID (e.g. ORD240801001) to check live shipping status.</p>

        <form onSubmit={handleSearch} className={styles.searchForm}>
          <input
            type="text"
            placeholder="Enter Order Number..."
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            required
          />
          <button type="submit">Track Order</button>
        </form>

        {searched && mockStatus && (
          <div className={styles.resultBox}>
            <div className={styles.orderSummary}>
              <div>
                <span className={styles.label}>Order Number:</span>
                <strong>{mockStatus.orderNumber}</strong>
              </div>
              <div>
                <span className={styles.label}>Courier Docket:</span>
                <strong>{mockStatus.trackingNumber}</strong>
              </div>
            </div>

            <div className={styles.timeline}>
              {mockStatus.steps.map((step, idx) => (
                <div key={idx} className={`${styles.timelineStep} ${step.done ? styles.completed : ''}`}>
                  <div className={styles.circle}>{step.done ? '✓' : idx + 1}</div>
                  <span>{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderTrackingModal;