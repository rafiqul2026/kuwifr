// client/src/pages/member/OrdersPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import { buildInvoiceHtml, printInvoice } from './invoiceDocument';
import styles from './OrdersPage.module.css';

// Status pill color mapping — matches the token set used across every
// other redesigned member page (TeamPage/DashboardPage): amber = pending,
// teal = paid/verified, blue = processing, green = completed, red =
// rejected/failed, grey = cancelled/refunded.
const STATUS_STYLES = {
  PENDING: { label: 'Pending', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
  AWAITING_VERIFICATION: { label: 'Awaiting Verification', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
  APPROVED: { label: 'Approved', color: '#008080', bg: 'rgba(0,128,128,0.12)' },
  VERIFIED: { label: 'Verified', color: '#008080', bg: 'rgba(0,128,128,0.12)' },
  PAID: { label: 'Paid', color: '#008080', bg: 'rgba(0,128,128,0.12)' },
  PROCESSING: { label: 'Processing', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
  SHIPPED: { label: 'Shipped', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
  PROCESSED: { label: 'Processed', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
  DELIVERED: { label: 'Delivered', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
  COMPLETED: { label: 'Completed', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
  SUCCESS: { label: 'Success', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
  REJECTED: { label: 'Rejected', color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
  FAILED: { label: 'Failed', color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
  CANCELLED: { label: 'Cancelled', color: '#737373', bg: 'rgba(115,115,115,0.12)' },
  REFUNDED: { label: 'Refunded', color: '#737373', bg: 'rgba(115,115,115,0.12)' }
};

const statusStyle = (status) =>
  STATUS_STYLES[(status || 'PAID').toUpperCase()] ||
  { label: (status || 'Paid').replace(/_/g, ' '), color: '#737373', bg: 'rgba(115,115,115,0.12)' };

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Line items + totals for the tax invoice. `invoiceItems` (unit amounts,
// with the product's MRP) comes from GET /api/orders/my-orders; the
// fallback only covers an order the server couldn't enrich — MRP is then
// the amount charged, so no offer is shown rather than a made-up one.
const buildInvoiceTotals = (order) => {
  const items = order.invoiceItems?.length
    ? order.invoiceItems
    : order.invoiceType === 'PACKAGE'
      ? [{ name: order.packageName || 'Membership Package', qty: 1, price: Number(order.totalAmount || order.price || 0) }]
      : (order.products || []).map((p) => ({ name: p.name, qty: p.quantity || 1, price: Number(p.price || 0) }));
  const normalized = items.map((it) => ({
    ...it,
    qty: Number(it.qty) || 1,
    price: Number(it.price) || 0,
    mrp: Math.max(Number(it.mrp) || 0, Number(it.price) || 0)
  }));
  const mrp = normalized.reduce((s, it) => s + it.mrp * it.qty, 0);
  const total = normalized.reduce((s, it) => s + it.price * it.qty, 0);
  return { items: normalized, mrp, offer: mrp - total, total };
};

const OrdersPage = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [activeTab, setActiveTab] = useState('packages'); // 'packages' | 'repurchase'
  const [packageOrders, setPackageOrders] = useState([]);
  const [repurchaseOrders, setRepurchaseOrders] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [billingProfile, setBillingProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderHistories();
  }, []);

  const fetchOrderHistories = async () => {
    try {
      setLoading(true);
      // Was previously hitting the admin-only `/api/orders` (returns every
      // member's orders and 403s for a non-admin member) with a hardcoded
      // "demo" fallback masking that failure — so every real member saw
      // fabricated sample invoices instead of their own (empty or real)
      // order history. `/my-orders` is the member-scoped endpoint that
      // actually returns this user's own packageOrders/repurchaseOrders.
      const res = await api.get('/api/orders/my-orders');

      if (res.data?.success && res.data.data) {
        const d = res.data.data;
        setBillingProfile(d.user || null);
        setPackageOrders(d.packageOrders || []);
        setRepurchaseOrders(d.repurchaseOrders || []);
      } else {
        setPackageOrders([]);
        setRepurchaseOrders([]);
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to load your order history.', 'error');
      setPackageOrders([]);
      setRepurchaseOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintInvoice = () => {
    printInvoice({ order: selectedInvoice, totals: buildInvoiceTotals(selectedInvoice), billedTo: billingProfile || user });
  };

  // Real, derived-only summary numbers for the KPI strip — nothing here is
  // fabricated, every figure is computed straight from the order lists
  // already fetched/rendered above.
  const summary = useMemo(() => {
    const totalOrders = packageOrders.length + repurchaseOrders.length;
    const totalPaid =
      packageOrders.reduce((sum, o) => sum + Number(o.price || o.totalAmount || 0), 0) +
      repurchaseOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    return {
      totalOrders,
      totalPackages: packageOrders.length,
      totalRepurchase: repurchaseOrders.length,
      totalPaid
    };
  }, [packageOrders, repurchaseOrders]);

  const billedTo = billingProfile || user;
  const invoiceHtml = selectedInvoice
    ? buildInvoiceHtml({ order: selectedInvoice, totals: buildInvoiceTotals(selectedInvoice), billedTo })
    : '';

  if (loading) {
    return (
      <div className={styles.pageLoaderScreen}>
        <div className={styles.glowSpinner}></div>
        <p className={styles.loadingText}>Loading invoices &amp; billing records...</p>
      </div>
    );
  }

  return (
    <div className={styles.ordersContainer}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div className={styles.titleGroup}>
          <div className={styles.titleBadge}>🧾 INVOICING &amp; PAYMENT HISTORY</div>
          <h1 className={styles.pageTitle}>Orders &amp; Tax Invoices</h1>
          <p className={styles.pageSubtitle}>
            View official digital tax invoices and payment histories for membership package activations and repurchase store orders.
          </p>
        </div>
      </div>

      {/* KPI Summary Strip — real numbers only, derived from the fetched order lists */}
      <div className={styles.gradientKpiGrid}>
        <div className={`${styles.gradientKpiCard} ${styles.gradientMint}`}>
          <div className={styles.gradientKpiTop}>
            <span className={styles.gradientKpiIcon}>🧾</span>
            <span className={styles.gradientKpiLabel}>Total Orders</span>
          </div>
          <h2 className={styles.gradientKpiValue}>{summary.totalOrders}</h2>
          <span className={styles.gradientKpiSub}>Package + repurchase combined</span>
        </div>

        <div className={`${styles.gradientKpiCard} ${styles.gradientBlue}`}>
          <div className={styles.gradientKpiTop}>
            <span className={styles.gradientKpiIcon}>📦</span>
            <span className={styles.gradientKpiLabel}>Package Purchases</span>
          </div>
          <h2 className={styles.gradientKpiValue}>{summary.totalPackages}</h2>
          <span className={styles.gradientKpiSub}>Membership activations</span>
        </div>

        <div className={`${styles.gradientKpiCard} ${styles.gradientPeach}`}>
          <div className={styles.gradientKpiTop}>
            <span className={styles.gradientKpiIcon}>🛍️</span>
            <span className={styles.gradientKpiLabel}>Repurchase Orders</span>
          </div>
          <h2 className={styles.gradientKpiValue}>{summary.totalRepurchase}</h2>
          <span className={styles.gradientKpiSub}>Store repurchase orders</span>
        </div>

        <div className={`${styles.gradientKpiCard} ${styles.gradientLavender}`}>
          <div className={styles.gradientKpiTop}>
            <span className={styles.gradientKpiIcon}>💰</span>
            <span className={styles.gradientKpiLabel}>Total Amount Paid</span>
          </div>
          <h2 className={styles.gradientKpiValue}>₹{summary.totalPaid.toLocaleString('en-IN')}</h2>
          <span className={styles.gradientKpiSub}>Across all invoices</span>
        </div>
      </div>

      {/* Segmented Controller */}
      <nav className={styles.tabsNav}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'packages' ? styles.tabActivePackage : ''}`}
          onClick={() => setActiveTab('packages')}
        >
          <span>📦 Package Purchases</span>
          <span className={styles.countPill}>{packageOrders.length}</span>
        </button>

        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'repurchase' ? styles.tabActiveRepurchase : ''}`}
          onClick={() => setActiveTab('repurchase')}
        >
          <span>🛍️ Repurchase Orders</span>
          <span className={styles.countPill}>{repurchaseOrders.length}</span>
        </button>
      </nav>

      {/* ================= VIEW 1: PACKAGE PURCHASES ================= */}
      {activeTab === 'packages' && (
        <section className={styles.historySection}>
          {packageOrders.length === 0 ? (
            <div className={styles.centerBox}>
              <h4 className={styles.emptyTitle}>No Package Purchases Found</h4>
              <p className={styles.emptyDesc}>Activate or upgrade your packages to view generated tax invoices.</p>
            </div>
          ) : (
            <div className={styles.tableCard}>
              <div className={styles.tableResponsive}>
                <table className={styles.customTable}>
                  <thead>
                    <tr>
                      <th className={styles.thOrder}>ORDER</th>
                      <th className={styles.thProduct}>SELECTED PRODUCT</th>
                      <th className={styles.thKbp}>KBP POINTS</th>
                      <th className={styles.thAmount}>AMOUNT PAID</th>
                      <th className={styles.thJoined}>DATE</th>
                      <th className={styles.thStatus}>STATUS</th>
                      <th className={styles.thAction}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packageOrders.map((ord) => {
                      const invoiceCode = ord.invoiceNumber || ord.orderNumber || `INV-PKG-${ord._id.slice(-5)}`;
                      const st = statusStyle(ord.paymentStatus);
                      return (
                        <tr key={ord._id} className={styles.tableRow}>
                          <td className={styles.tdOrder}>
                            <div className={styles.orderIdentityBlock}>
                              <div className={styles.orderAvatar}>📦</div>
                              <div className={styles.nameBlock}>
                                <span className={styles.orderNameText}>{ord.packageName || 'Starter Package'}</span>
                                <span className={styles.orderIdSubText}>{invoiceCode}</span>
                              </div>
                            </div>
                          </td>
                          <td className={styles.tdProduct}>
                            <div className={styles.productSnippet}>
                              {ord.selectedProduct?.image && (
                                <img src={ord.selectedProduct.image} alt={ord.selectedProduct.name} />
                              )}
                              <span>{ord.selectedProduct?.name || 'Package Included Product'}</span>
                            </div>
                          </td>
                          <td className={styles.tdKbp}>
                            <span className={styles.kbpBadge}>⭐ {(ord.kbpGenerated ?? ord.products?.[0]?.kbp ?? 0).toLocaleString()} KBP</span>
                          </td>
                          <td className={styles.tdAmount}>
                            <strong className={styles.amountText}>₹{(ord.price || ord.totalAmount)?.toLocaleString()}</strong>
                          </td>
                          <td className={styles.tdJoined}>
                            <span className={styles.joinedDateText}>{formatDate(ord.createdAt)}</span>
                          </td>
                          <td className={styles.tdStatus}>
                            <span className={styles.statusPill} style={{ color: st.color, background: st.bg }}>
                              <span className={styles.statusDot} style={{ background: st.color }}></span>
                              {st.label}
                            </span>
                          </td>
                          <td className={styles.tdAction}>
                            <button
                              type="button"
                              className={styles.actionViewBtn}
                              onClick={() => setSelectedInvoice({ ...ord, invoiceType: 'PACKAGE' })}
                            >
                              <span>View</span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"></path>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ================= VIEW 2: REPURCHASE ORDERS ================= */}
      {activeTab === 'repurchase' && (
        <section className={styles.historySection}>
          {repurchaseOrders.length === 0 ? (
            <div className={styles.centerBox}>
              <h4 className={styles.emptyTitle}>No Repurchase Orders Found</h4>
              <p className={styles.emptyDesc}>Browse the Repurchase Store to purchase products with 20% Self Cashback.</p>
            </div>
          ) : (
            <div className={styles.tableCard}>
              <div className={styles.tableResponsive}>
                <table className={styles.customTable}>
                  <thead>
                    <tr>
                      <th className={styles.thOrder}>ORDER</th>
                      <th className={styles.thProduct}>ITEMS PURCHASED</th>
                      <th className={styles.thKbp}>TOTAL VOLUME</th>
                      <th className={styles.thAmount}>SELF CASHBACK</th>
                      <th className={styles.thAmount}>TOTAL PAID</th>
                      <th className={styles.thJoined}>DATE</th>
                      <th className={styles.thStatus}>STATUS</th>
                      <th className={styles.thAction}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repurchaseOrders.map((ord) => {
                      const invoiceCode = ord.invoiceNumber || ord.orderNumber || `INV-REP-${ord._id.slice(-5)}`;
                      const st = statusStyle(ord.paymentStatus);
                      return (
                        <tr key={ord._id} className={styles.tableRow}>
                          <td className={styles.tdOrder}>
                            <div className={styles.orderIdentityBlock}>
                              <div className={styles.orderAvatar}>🛍️</div>
                              <div className={styles.nameBlock}>
                                <span className={styles.orderNameText}>Repurchase Order</span>
                                <span className={styles.orderIdSubText}>{invoiceCode}</span>
                              </div>
                            </div>
                          </td>
                          <td className={styles.tdProduct}>
                            <div className={styles.itemsSummary}>
                              <strong>{ord.products?.length || 1} Item(s)</strong>
                              <small>{ord.products?.map((i) => i.name).join(', ').slice(0, 32)}...</small>
                            </div>
                          </td>
                          <td className={styles.tdKbp}>
                            <span className={styles.kbpBadge}>⭐ {(ord.kbpGenerated || 0).toLocaleString()} KBP</span>
                          </td>
                          <td className={styles.tdAmount}>
                            <span className={styles.cashbackChip}>+₹{(ord.selfCashback || 0).toLocaleString()}</span>
                          </td>
                          <td className={styles.tdAmount}>
                            <strong className={styles.amountText}>₹{ord.totalAmount?.toLocaleString()}</strong>
                          </td>
                          <td className={styles.tdJoined}>
                            <span className={styles.joinedDateText}>{formatDate(ord.createdAt)}</span>
                          </td>
                          <td className={styles.tdStatus}>
                            <span className={styles.statusPill} style={{ color: st.color, background: st.bg }}>
                              <span className={styles.statusDot} style={{ background: st.color }}></span>
                              {st.label}
                            </span>
                          </td>
                          <td className={styles.tdAction}>
                            <button
                              type="button"
                              className={styles.actionViewBtn}
                              onClick={() => setSelectedInvoice({ ...ord, invoiceType: 'REPURCHASE' })}
                            >
                              <span>View</span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"></path>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ================= INVOICE MODAL (CLEAN 1-PAGE CORPORATE TAX INVOICE) ================= */}
      {selectedInvoice && (
        <div className={styles.invoiceModalOverlay} onClick={() => setSelectedInvoice(null)}>
          <div className={styles.invoiceModalContainer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalActionsBar}>
              <button type="button" className={styles.printBtn} onClick={handlePrintInvoice}>
                ⬇️ Download / Print PDF
              </button>
              <button type="button" className={styles.closeBtn} onClick={() => setSelectedInvoice(null)}>
                ✕ Close
              </button>
            </div>

            {/* The exact document that gets printed/downloaded (invoiceDocument.js) */}
            <div className={styles.invoicePreviewScroll}>
              <iframe
                title="Tax invoice preview"
                className={styles.invoicePreviewFrame}
                srcDoc={invoiceHtml}
                onLoad={(e) => {
                  const doc = e.currentTarget.contentDocument;
                  if (doc) e.currentTarget.style.height = `${doc.documentElement.scrollHeight}px`;
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;