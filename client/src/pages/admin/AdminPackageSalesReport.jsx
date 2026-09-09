// client/src/pages/admin/AdminPackageSalesReport.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "./AdminPackageSalesReport.module.css";

export default function AdminPackageSalesReport() {
  const [sales, setSales] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPackage, setSelectedPackage] = useState("ALL");
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });

  // Modal State for Cash Package Activation
  const [showModal, setShowModal] = useState(false);
  const [memberInput, setMemberInput] = useState("");
  const [searchedMember, setSearchedMember] = useState(null);
  const [packagesList, setPackagesList] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReport = async (page = 1) => {
    try {
      setLoading(true);
      const res = await axios.get("/api/admin/package-sales-report", {
        params: { 
          page, 
          packageName: selectedPackage,
          search 
        },
        withCredentials: true,
      });
      if (res.data.success) {
        setSales(res.data.data.sales);
        setStats(res.data.data.statistics);
        setPagination(res.data.data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch package sales report:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPackagesCatalog = async () => {
    try {
      const res = await axios.get("/api/packages", { withCredentials: true });
      if (res.data.success) {
        setPackagesList(res.data.data.packages || res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch packages catalog:", err);
    }
  };

  useEffect(() => {
    fetchReport(1);
    fetchPackagesCatalog();
  }, [selectedPackage]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchReport(1);
  };

  const handleMemberSearch = async (e) => {
    e.preventDefault();
    if (!memberInput.trim()) return;
    try {
      const res = await axios.get("/api/admin/members/search", {
        params: { query: memberInput.trim() },
        withCredentials: true,
      });
      const members = res.data?.data?.members || [];
      if (members.length > 0) {
        setSearchedMember(members[0]);
      } else {
        alert("Member not found.");
        setSearchedMember(null);
      }
    } catch (err) {
      console.error(err);
      alert("Error searching member.");
    }
  };

  const handlePackageRadioSelect = (pkg) => {
    setSelectedPackageId(pkg._id);
    setCashAmount(pkg.price || pkg.packagePrice || 1500);
  };

  const handleActivateSubmit = async (e) => {
    e.preventDefault();
    if (!searchedMember || !selectedPackageId || !cashAmount) {
      alert("Please select a member and package.");
      return;
    }

    if (!window.confirm(`Activate member ${searchedMember.memberId} (${searchedMember.fullName}) with Cash Payment?`)) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await axios.post(
        "/api/admin/package-activations",
        {
          memberIdentifier: searchedMember.memberId,
          packageId: selectedPackageId,
          cashAmount: Number(cashAmount),
          receiptNumber,
          notes,
        },
        { withCredentials: true }
      );

      alert(res.data.message || "Package activated successfully!");
      setShowModal(false);
      setSearchedMember(null);
      setMemberInput("");
      setSelectedPackageId("");
      setCashAmount("");
      setReceiptNumber("");
      setNotes("");
      fetchReport(1);
    } catch (err) {
      alert(err.response?.data?.message || "Package activation failed.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>📈 Package Sales & Cash Activation Report</h1>
          <p className={styles.pageSubtitle}>Track real-time package purchases, cash activations, and KBP-based distributions.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setShowModal(true)}
            style={{ background: "#2563eb", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
          >
            + Activate New Package (Cash)
          </button>
          <button
            onClick={() => fetchReport(pagination.page)}
            className={styles.refreshBtn}
          >
            Refresh Report
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className={styles.statsGrid}>
        {stats.map((st, idx) => (
          <div key={idx} className={styles.statCard}>
            <h3 className={styles.statLabel}>{st._id || "Standard Package"}</h3>
            <p className={styles.statValue}>₹{st.totalRevenue?.toLocaleString()}</p>
            <span className={styles.statBadge}>{st.totalUnits} Units Sold</span>
          </div>
        ))}
      </div>

      {/* Filters & Search Bar */}
      <div className={styles.filterBar}>
        <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
          <input
            type="text"
            placeholder="Search by Member ID, Name, or Email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          <button type="submit" className={styles.searchBtn}>Search</button>
        </form>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Filter Package:</span>
          <select
            value={selectedPackage}
            onChange={(e) => setSelectedPackage(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">All Packages</option>
            <option value="Starter Package">Starter Package</option>
            <option value="Growth Package">Growth Package</option>
            <option value="Life Safe Package">Life Safe Package</option>
            <option value="Life Safe Elite Package">Life Safe Elite Package</option>
            <option value="Titanium Package">Titanium Package</option>
          </select>
        </div>
      </div>

      {/* Sales Table */}
      <div className={styles.tableContainer}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead className={styles.tableHead}>
              <tr>
                <th>Date & Time</th>
                <th>Member Details</th>
                <th>Package Tier</th>
                <th>Product Included</th>
                <th>Amount</th>
                <th>KBP Earned</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className={styles.tableBody}>
              {loading ? (
                <tr><td colSpan="7" className={styles.emptyState}>Loading report records...</td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan="7" className={styles.emptyState}>No package sales records found.</td></tr>
              ) : (
                sales.map((item) => (
                  <tr key={item._id}>
                    <td className={`${styles.tableCell} ${styles.dateCell}`}>
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className={styles.tableCell}>
                      <div className={styles.memberName}>{item.customerName || item.userId?.fullName || "N/A"}</div>
                      <div className={styles.memberId}>{item.userId?.memberId || "N/A"}</div>
                    </td>
                    <td className={`${styles.tableCell} ${styles.packageName}`}>{item.packageName}</td>
                    <td className={styles.tableCell}>{item.products?.[0]?.name || "Standard Kit"}</td>
                    <td className={`${styles.tableCell} ${styles.amount}`}>₹{item.totalAmount?.toLocaleString()}</td>
                    <td className={`${styles.tableCell} ${styles.kbpEarned}`}>+{item.kbpGenerated} KBP</td>
                    <td className={styles.tableCell}>
                      <span className={styles.statusBadge}>{item.status || "COMPLETED"}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cash Activation Modal */}
      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", padding: "30px", borderRadius: "12px", width: "500px", maxWidth: "90%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <h2 style={{ marginBottom: "20px", color: "#1e293b" }}>Admin Cash Package Activation</h2>

            {!searchedMember ? (
              <form onSubmit={handleMemberSearch}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Find Member ID, Email, or Mobile:</label>
                <input
                  type="text"
                  placeholder="e.g. KFR123456"
                  value={memberInput}
                  onChange={(e) => setMemberInput(e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  required
                />
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button type="submit" style={{ background: "#2563eb", color: "#fff", padding: "10px 16px", border: "none", borderRadius: "6px", cursor: "pointer" }}>Search Member</button>
                  <button type="button" onClick={() => setShowModal(false)} style={{ background: "#64748b", color: "#fff", padding: "10px 16px", border: "none", borderRadius: "6px", cursor: "pointer" }}>Cancel</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleActivateSubmit}>
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", marginBottom: "15px", border: "1px solid #e2e8f0" }}>
                  <p style={{ margin: "4px 0" }}><strong>Member ID:</strong> {searchedMember.memberId}</p>
                  <p style={{ margin: "4px 0" }}><strong>Name:</strong> {searchedMember.fullName}</p>
                  <p style={{ margin: "4px 0" }}><strong>Email:</strong> {searchedMember.email}</p>
                  <p style={{ margin: "4px 0" }}><strong>Current Status:</strong> {searchedMember.status}</p>
                </div>

                <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Select Package Tier:</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "15px" }}>
                  {packagesList.map((pkg) => (
                    <label key={pkg._id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", background: selectedPackageId === pkg._id ? "#eff6ff" : "#fff" }}>
                      <input
                        type="radio"
                        name="packageSelection"
                        checked={selectedPackageId === pkg._id}
                        onChange={() => handlePackageRadioSelect(pkg)}
                      />
                      <span><strong>{pkg.name}</strong> - Price: ₹{pkg.price || pkg.packagePrice} | <em>KBP: {pkg.kbpValue || pkg.kbp}</em></span>
                    </label>
                  ))}
                </div>

                <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Cash Amount (₹):</label>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  required
                />

                <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Receipt / Reference Number:</label>
                <input
                  type="text"
                  placeholder="e.g. CASH-RCPT-9821"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />

                <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Admin Notes:</label>
                <textarea
                  placeholder="Optional verification notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "20px", borderRadius: "6px", border: "1px solid #cbd5e1", height: "60px" }}
                />

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button type="submit" disabled={actionLoading} style={{ background: "#16a34a", color: "#fff", padding: "10px 18px", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
                    {actionLoading ? "Activating & Distributing..." : "Confirm & Activate Package"}
                  </button>
                  <button type="button" onClick={() => setSearchedMember(null)} style={{ background: "#64748b", color: "#fff", padding: "10px 16px", border: "none", borderRadius: "6px", cursor: "pointer" }}>Back to Search</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}