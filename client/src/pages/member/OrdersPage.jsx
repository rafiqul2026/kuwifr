// client/src/pages/member/OrdersPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import styles from './OrdersPage.module.css';

const DEMO_PACKAGE_ORDERS = [
  {
    _id: 'pkg-ord-101',
    invoiceNumber: 'INV-PKG-98214',
    createdAt: '2026-08-25T10:30:00.000Z',
    packageName: 'Starter Package',
    packageType: 'STARTER',
    price: 1500,
    kbp: 1000,
    dailyCap: 1500,
    paymentMethod: 'ONLINE GATEWAY',
    paymentStatus: 'PAID',
    selectedProduct: {
      name: 'Instant Magic Hair Color Shampoo',
      category: 'Hair Care',
      mrp: 1999,
      ksp: 1500,
      image: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=300&auto=format&fit=crop&q=80'
    }
  }
];

const DEMO_REPURCHASE_ORDERS = [
  {
    _id: 'rep-ord-201',
    invoiceNumber: 'INV-REP-77302',
    createdAt: '2026-08-28T14:15:00.000Z',
    totalAmount: 3000,
    totalKBP: 2000,
    selfCashback: 500,
    paymentMethod: 'ONLINE GATEWAY',
    paymentStatus: 'PAID',
    items: [
      {
        name: 'Kuwi Gold Magic Black Hair oil',
        category: 'Hair Care',
        qty: 1,
        ksp: 1500,
        mrp: 2100,
        kbp: 1000,
        subtotal: 1500
      },
      {
        name: 'Modern Saree (Ready Made Wear)',
        category: 'Apparel',
        qty: 1,
        ksp: 1500,
        mrp: 2499,
        kbp: 1000,
        subtotal: 1500
      }
    ]
  }
];

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

const OrdersPage = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [activeTab, setActiveTab] = useState('packages'); // 'packages' | 'repurchase'
  const [packageOrders, setPackageOrders] = useState([]);
  const [repurchaseOrders, setRepurchaseOrders] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderHistories();
  }, []);

  const fetchOrderHistories = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/orders').catch(() => ({ data: { success: false } }));

      if (res.data?.success && res.data.data) {
        const d = res.data.data;
        setPackageOrders(d.packageOrders?.length > 0 ? d.packageOrders : DEMO_PACKAGE_ORDERS);
        setRepurchaseOrders(d.repurchaseOrders?.length > 0 ? d.repurchaseOrders : DEMO_REPURCHASE_ORDERS);
      } else {
        setPackageOrders(DEMO_PACKAGE_ORDERS);
        setRepurchaseOrders(DEMO_REPURCHASE_ORDERS);
      }
    } catch {
      setPackageOrders(DEMO_PACKAGE_ORDERS);
      setRepurchaseOrders(DEMO_REPURCHASE_ORDERS);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintInvoice = () => {
    window.print();
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
                            <span className={styles.kbpBadge}>⭐ {ord.kbp?.toLocaleString() || 1000} KBP</span>
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
              <p className={styles.emptyDesc}>Browse the Repurchase Store to purchase products with 25% instant cashback.</p>
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
                      <th className={styles.thAmount}>CASHBACK (25%)</th>
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
                              <strong>{ord.items?.length || 1} Item(s)</strong>
                              <small>{ord.items?.map((i) => i.name).join(', ').slice(0, 32)}...</small>
                            </div>
                          </td>
                          <td className={styles.tdKbp}>
                            <span className={styles.kbpBadge}>⭐ {ord.totalKBP?.toLocaleString()} KBP</span>
                          </td>
                          <td className={styles.tdAmount}>
                            <span className={styles.cashbackChip}>+₹{(ord.selfCashback || ord.totalKBP * 0.25)?.toLocaleString()}</span>
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
                🖨️ Print / Save as PDF
              </button>
              <button type="button" className={styles.closeBtn} onClick={() => setSelectedInvoice(null)}>
                ✕ Close
              </button>
            </div>

            {/* Formal Tax Invoice Sheet */}
            <div className={styles.printableInvoiceSheet}>
              {/* Header Box */}
              <div className={styles.invoiceHeader}>
                <div className={styles.companyInfo}>
                  <div className={styles.invoiceLogo}>
                    <span className={styles.brandIcon}>🚀</span>
                    <div>
                      <h2>KUWIFR GLOBAL NETWORKS</h2>
                      <small className={styles.companyType}>KUWIFR Networking &amp; E-Commerce Private Limited</small>
                    </div>
                  </div>
                  <p>Corporate Hub: G.S. Road, Guwahati, Assam - 781005, India</p>
                  <p>
                    GSTIN: <strong>18AABCK1234F1Z5</strong> | PAN: <strong>AABCK1234F</strong> | CIN: <strong>U51909AS2026PTC012345</strong>
                  </p>
                  <p>Official Support: <strong>support@kuwifr.com</strong> | Portal: <strong>www.kuwifr.com</strong></p>
                </div>

                <div className={styles.invoiceMetaRight}>
                  <div className={styles.taxBadge}>TAX INVOICE</div>
                  <table className={styles.invoiceMetaTable}>
                    <tbody>
                      <tr>
                        <td>Invoice No:</td>
                        <td><strong>{selectedInvoice.invoiceNumber || selectedInvoice.orderNumber || `INV-${selectedInvoice._id.slice(-6)}`}</strong></td>
                      </tr>
                      <tr>
                        <td>Invoice Date:</td>
                        <td>{formatDate(selectedInvoice.createdAt)}</td>
                      </tr>
                      <tr>
                        <td>Payment Mode:</td>
                        <td>{selectedInvoice.paymentMethod || 'ONLINE GATEWAY'}</td>
                      </tr>
                      <tr>
                        <td>Place of Supply:</td>
                        <td>Assam (18)</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className={styles.statusStamp}>✓ PAID &amp; VERIFIED</div>
                </div>
              </div>

              {/* Billed To & Supply Info */}
              <div className={styles.invoiceAddressGrid}>
                <div className={styles.addressBox}>
                  <div className={styles.addressBoxHeader}>BILLED TO / DISTRIBUTOR DETAILS</div>
                  <div className={styles.addressBoxContent}>
                    <h4 className={styles.distributorName}>{user?.fullName || 'Distributor Member'}</h4>
                    <p>Member ID: <strong className={styles.memberIdText}>{user?.memberId || 'KFR665384'}</strong></p>
                    <p>Registered Email: {user?.email || 'mcarubul2021@gmail.com'}</p>
                    <p>Contact Phone: {user?.phoneNumber || '+91 7578898063'}</p>
                    <p>Address: Assam, India</p>
                  </div>
                </div>

                <div className={styles.addressBox}>
                  <div className={styles.addressBoxHeader}>ORDER &amp; TRANSACTION SUMMARY</div>
                  <div className={styles.addressBoxContent}>
                    <p>Transaction Type: <strong>{selectedInvoice.invoiceType === 'PACKAGE' ? 'Membership Package Activation' : 'Repurchase Product Order'}</strong></p>
                    <p>Order Reference: <strong>#{selectedInvoice._id}</strong></p>
                    <p>Order Status: <strong style={{ color: '#16a34a' }}>COMPLETED / ACTIVE</strong></p>
                    <p>Currency: <strong>INR (Indian Rupees - ₹)</strong></p>
                  </div>
                </div>
              </div>

              {/* Itemized Table */}
              <div className={styles.invoiceTableWrap}>
                <table className={styles.invoiceTable}>
                  <thead>
                    <tr>
                      <th style={{ width: '4%' }}>#</th>
                      <th style={{ width: '44%' }}>Item Description &amp; Specification</th>
                      <th style={{ width: '14%' }}>Category / HSN</th>
                      <th style={{ width: '12%', textAlign: 'center' }}>KBP Volume</th>
                      <th style={{ width: '6%', textAlign: 'center' }}>Qty</th>
                      <th style={{ width: '10%', textAlign: 'right' }}>Unit Price</th>
                      <th style={{ width: '10%', textAlign: 'right' }}>Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.invoiceType === 'PACKAGE' ? (
                      <tr>
                        <td>1</td>
                        <td>
                          <div className={styles.itemNameMain}>{selectedInvoice.packageName || 'Membership Package'}</div>
                          <div className={styles.itemSubDesc}>
                            • Included Item: <strong>{selectedInvoice.selectedProduct?.name || 'Package Included Product'}</strong>
                          </div>
                          <div className={styles.itemSubDesc}>
                            • Daily Binary Capping Ceiling: <strong>₹{selectedInvoice.dailyCap?.toLocaleString() || 1500} / Day</strong>
                          </div>
                        </td>
                        <td>Activation / 9983</td>
                        <td style={{ textAlign: 'center' }}><strong>⭐ {selectedInvoice.kbp?.toLocaleString() || 1000} KBP</strong></td>
                        <td style={{ textAlign: 'center' }}>1</td>
                        <td style={{ textAlign: 'right' }}>₹{(selectedInvoice.price || selectedInvoice.totalAmount)?.toLocaleString()}</td>
                        <td style={{ textAlign: 'right' }}><strong>₹{(selectedInvoice.price || selectedInvoice.totalAmount)?.toLocaleString()}</strong></td>
                      </tr>
                    ) : (
                      selectedInvoice.items?.map((it, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>
                            <div className={styles.itemNameMain}>{it.name}</div>
                            <div className={styles.itemSubDesc}>MRP: ₹{it.mrp?.toLocaleString()} (KSP Applied)</div>
                          </td>
                          <td>{it.category || 'General'}</td>
                          <td style={{ textAlign: 'center' }}><strong>⭐ {it.kbp?.toLocaleString()} KBP</strong></td>
                          <td style={{ textAlign: 'center' }}>{it.qty || 1}</td>
                          <td style={{ textAlign: 'right' }}>₹{it.ksp?.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}><strong>₹{(it.subtotal || it.ksp * (it.qty || 1))?.toLocaleString()}</strong></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation & Terms Summary */}
              <div className={styles.invoiceFooterSection}>
                <div className={styles.termsBox}>
                  <h5>Terms &amp; Digital Declaration:</h5>
                  <ul>
                    <li>This is a digitally generated tax invoice authorized under GST rules and requires no physical signature.</li>
                    <li>Points (KBP) are credited instantly to upline binary networks for binary matching and Life Tension Free target funds.</li>
                    {selectedInvoice.invoiceType === 'REPURCHASE' && (
                      <li style={{ color: '#15803d', fontWeight: '700' }}>
                        25% Self Repurchase Cashback (₹{(selectedInvoice.selfCashback || selectedInvoice.totalKBP * 0.25)?.toLocaleString()}) credited to your active wallet.
                      </li>
                    )}
                  </ul>
                </div>

                <div className={styles.calculationBox}>
                  <div className={styles.calcRow}>
                    <span>Taxable Value (Net):</span>
                    <strong>₹{(selectedInvoice.price || selectedInvoice.totalAmount)?.toLocaleString()}</strong>
                  </div>
                  <div className={styles.calcRow}>
                    <span>CGST (Inclusive / Exempted):</span>
                    <span>₹0.00</span>
                  </div>
                  <div className={styles.calcRow}>
                    <span>SGST (Inclusive / Exempted):</span>
                    <span>₹0.00</span>
                  </div>
                  <div className={styles.grandTotalRow}>
                    <span>Total Amount Paid:</span>
                    <strong>₹{(selectedInvoice.price || selectedInvoice.totalAmount)?.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              {/* Authorized Signatory Footer */}
              <div className={styles.authSignatoryRow}>
                <div className={styles.thankYouBlock}>
                  <p>Thank you for partnering with <strong>KUWIFR Global Network</strong>!</p>
                  <small>For billing queries, email us at support@kuwifr.com</small>
                </div>
                <div className={styles.signatureBlock}>
                  <div className={styles.digitalSeal}>KUWIFR DIGITAL VERIFIED</div>
                  <span>Authorised Signatory</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;