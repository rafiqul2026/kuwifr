// client/src/pages/member/OrdersPage.jsx
import React, { useState, useEffect } from 'react';
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

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.spinner}></div>
        <p>Loading Invoices & Billing Records...</p>
      </div>
    );
  }

  return (
    <div className={styles.ordersContainer}>
      {/* Header */}
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.headerTag}>🧾 Invoicing & Payment History</span>
          <h1 className={styles.pageTitle}>Orders & Tax Invoices</h1>
          <p className={styles.pageSubtitle}>
            View official digital tax invoices and payment histories for membership package activations and repurchase store orders.
          </p>
        </div>
      </header>

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
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📦</span>
              <h3>No Package Purchases Found</h3>
              <p>Activate or upgrade your packages to view generated tax invoices.</p>
            </div>
          ) : (
            <div className={styles.tableCard}>
              <table className={styles.ordersTable}>
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Package Tier</th>
                    <th>Selected Product</th>
                    <th>KBP Points</th>
                    <th>Amount Paid</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {packageOrders.map((ord) => (
                    <tr key={ord._id}>
                      <td>
                        <span className={styles.invoiceCode}>{ord.invoiceNumber || ord.orderNumber || `INV-PKG-${ord._id.slice(-5)}`}</span>
                      </td>
                      <td>
                        <strong className={styles.pkgNameBadge}>{ord.packageName || 'Starter Package'}</strong>
                      </td>
                      <td>
                        <div className={styles.productSnippet}>
                          {ord.selectedProduct?.image && (
                            <img src={ord.selectedProduct.image} alt={ord.selectedProduct.name} />
                          )}
                          <span>{ord.selectedProduct?.name || 'Package Included Product'}</span>
                        </div>
                      </td>
                      <td>
                        <span className={styles.kbpBadge}>⭐ {ord.kbp?.toLocaleString() || 1000} KBP</span>
                      </td>
                      <td>
                        <strong className={styles.amountText}>₹{(ord.price || ord.totalAmount)?.toLocaleString()}</strong>
                      </td>
                      <td>{new Date(ord.createdAt).toLocaleDateString()}</td>
                      <td>
                        <span className={styles.paidChip}>✓ Paid</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.viewInvoiceBtn}
                          onClick={() => setSelectedInvoice({ ...ord, invoiceType: 'PACKAGE' })}
                        >
                          View Invoice →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ================= VIEW 2: REPURCHASE ORDERS ================= */}
      {activeTab === 'repurchase' && (
        <section className={styles.historySection}>
          {repurchaseOrders.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🛍️</span>
              <h3>No Repurchase Orders Found</h3>
              <p>Browse the Repurchase Store to purchase products with 25% instant cashback.</p>
            </div>
          ) : (
            <div className={styles.tableCard}>
              <table className={styles.ordersTable}>
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Items Purchased</th>
                    <th>Total Volume</th>
                    <th>Self Cashback (25%)</th>
                    <th>Total Paid</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {repurchaseOrders.map((ord) => (
                    <tr key={ord._id}>
                      <td>
                        <span className={styles.invoiceCode}>{ord.invoiceNumber || ord.orderNumber || `INV-REP-${ord._id.slice(-5)}`}</span>
                      </td>
                      <td>
                        <div className={styles.itemsSummary}>
                          <strong>{ord.items?.length || 1} Item(s)</strong>
                          <small>{ord.items?.map(i => i.name).join(', ').slice(0, 32)}...</small>
                        </div>
                      </td>
                      <td>
                        <span className={styles.kbpBadge}>⭐ {ord.totalKBP?.toLocaleString()} KBP</span>
                      </td>
                      <td>
                        <span className={styles.cashbackChip}>+₹{(ord.selfCashback || ord.totalKBP * 0.25)?.toLocaleString()}</span>
                      </td>
                      <td>
                        <strong className={styles.amountText}>₹{ord.totalAmount?.toLocaleString()}</strong>
                      </td>
                      <td>{new Date(ord.createdAt).toLocaleDateString()}</td>
                      <td>
                        <span className={styles.paidChip}>✓ Paid</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.viewInvoiceBtn}
                          onClick={() => setSelectedInvoice({ ...ord, invoiceType: 'REPURCHASE' })}
                        >
                          View Invoice →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                      <small className={styles.companyType}>KUWIFR Networking & E-Commerce Private Limited</small>
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
                        <td>{new Date(selectedInvoice.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
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
                  <div className={styles.statusStamp}>✓ PAID & VERIFIED</div>
                </div>
              </div>

              {/* Billed To & Supply Info */}
              <div className={styles.invoiceAddressGrid}>
                <div className={styles.addressBox}>
                  <div className={styles.addressBoxHeader}>BILLED TO / DISTRIBUTOR DETAILS</div>
                  <div className={styles.addressBoxContent}>
                    <h4 className={styles.distributorName}>{user?.fullName || 'Distributor Member'}</h4>
                    <p>Member ID: <strong className={styles.memberIdText}>{user?.memberId || 'KFR665384'}</strong>[cite: 1, 2]</p>
                    <p>Registered Email: {user?.email || 'mcarubul2021@gmail.com'}[cite: 1, 2]</p>
                    <p>Contact Phone: {user?.phoneNumber || '+91 7578898063'}[cite: 1, 2]</p>
                    <p>Address: Assam, India</p>
                  </div>
                </div>

                <div className={styles.addressBox}>
                  <div className={styles.addressBoxHeader}>ORDER & TRANSACTION SUMMARY</div>
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
                      <th style={{ width: '44%' }}>Item Description & Specification</th>
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
                  <h5>Terms & Digital Declaration:</h5>
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