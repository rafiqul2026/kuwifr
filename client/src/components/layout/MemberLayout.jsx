// client/src/components/layout/MemberLayout.jsx
import React, { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./MemberLayout.module.css";

// ============================================================
// 🧭 MEMBER SIDEBAR NAVIGATION ITEMS (WITH PACKAGE SUBMENU)
// ============================================================
const navItems = [
  // 1. Dashboard
  { id: "dashboard", label: "Dashboard", icon: "📊", path: "/member/dashboard" },
  // 2. Profile
  { id: "profile", label: "Profile", icon: "👤", path: "/member/profile" },
  // 3. KYC Verification
  { id: "kyc", label: "KYC Verification", icon: "🪪", path: "/member/kyc" },
  // 4. Wallet
  { id: "wallet", label: "Wallet", icon: "💰", path: "/member/wallet" },
  // 5. Bonanza
  { id: "bonanza", label: "Bonanza", icon: "🏖️", path: "/member/bonanza" },
  // 6. Repurchase
  { id: "repurchase", label: "Repurchase", icon: "🛍️", path: "/member/repurchase" },
  // 7. Income Overview
  { id: "income", label: "Income", icon: "📈", path: "/member/income" },
  // 8. Team Management
  { id: "team", label: "Team", icon: "👥", path: "/member/team" },
  // 9. Binary Tree
  { id: "binary", label: "Binary", icon: "🌳", path: "/member/binary" },

  // 10. PACKAGE DROPDOWN (Parent: Package -> Sub: Buy Package, Upgrade Package)
  {
    id: "package_group",
    label: "Package",
    icon: "📦",
    path: "/member/packages",
    isDropdown: true,
    subItems: [
      { id: "buy_package", label: "Buy Package", icon: "🛍️", path: "/member/packages" },
      { id: "upgrade_package", label: "Upgrade Package", icon: "🚀", path: "/member/packages/upgrade" }
    ]
  },

  // 11. Orders
  { id: "orders", label: "Orders", icon: "🛒", path: "/member/orders" },
  // 12. Withdrawals
  { id: "withdrawals", label: "Withdrawals", icon: "💸", path: "/member/withdrawals" },
  // 13. Ranks & Rewards
  { id: "ranks", label: "Ranks", icon: "🏆", path: "/member/ranks" },
  // 14. Notifications
  { id: "notifications", label: "Notifications", icon: "🔔", path: "/member/notifications" },
  // 15. Help & Support
  { id: "support", label: "Help & Support", icon: "🎧", path: "/member/support" },
];

const MemberLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [packageDropdownOpen, setPackageDropdownOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(true);
        setMobileDrawerOpen(false);
      } else {
        setSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
      setMobileDrawerOpen(false);
    }
  }, [location.pathname, isMobile]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
    if (mobileDrawerOpen) setMobileDrawerOpen(false);
  };

  const toggleMobileDrawer = () => {
    setMobileDrawerOpen(!mobileDrawerOpen);
    if (sidebarOpen) setSidebarOpen(false);
  };

  const closeAllMenus = () => {
    setSidebarOpen(false);
    setMobileDrawerOpen(false);
  };

  const isActive = (path) => location.pathname === path;
  const isPackageGroupActive = location.pathname.startsWith("/member/packages");

  return (
    <div className={styles.memberLayout}>
      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            className={styles.menuBtn}
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            <span className={styles.menuIcon}></span>
          </button>
          <div
            className={styles.logo}
            onClick={() => navigate("/member/dashboard")}
            style={{ cursor: "pointer" }}
          >
            <span className={styles.logoIcon}>🚀</span>
            <span className={styles.logoText}>KUWIFR</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button
            className={styles.notificationBtn}
            onClick={() => navigate("/member/notifications")}
            aria-label="Notifications"
          >
            🔔
            <span className={styles.notificationBadge}></span>
          </button>
          <div className={styles.userInfo}>
            <span className={styles.userName}>
              {user?.fullName || "Member"}
            </span>
            <span className={styles.userRole}>
              User ID: {user?.memberId || "KFR------"}
            </span>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* ================= DESKTOP & EXPANDED SIDEBAR ================= */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ""}`}>
        {/* User Card */}
        <div className={styles.sidebarUser}>
          <div className={styles.sidebarAvatar}>
            {user?.profileImage?.url ? (
              <img
                src={user.profileImage.url}
                alt={user.fullName || "User"}
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            ) : (
              user?.fullName?.charAt(0) || "M"
            )}
          </div>
          <div className={styles.sidebarUserInfo}>
            <span className={styles.sidebarUserName}>
              {user?.fullName || "Member"}
            </span>
            <span
              className={styles.sidebarUserRole}
              style={{ color: "#38bdf8", fontWeight: "700" }}
            >
              User ID: {user?.memberId || "KFR------"}
            </span>
          </div>
        </div>

        {/* Sidebar Nav Links with Dropdown Menu */}
        <nav className={styles.sidebarNav}>
          {navItems.map((item) => {
            if (item.isDropdown) {
              return (
                <div key={item.id} className={styles.dropdownGroup}>
                  <button
                    type="button"
                    className={`${styles.navItem} ${isPackageGroupActive ? styles.active : ""}`}
                    onClick={() => setPackageDropdownOpen(!packageDropdownOpen)}
                  >
                    <span className={styles.navIcon}>{item.icon}</span>
                    <span className={styles.navLabel}>{item.label}</span>
                    <span className={styles.dropdownCaret}>
                      {packageDropdownOpen ? "▲" : "▼"}
                    </span>
                  </button>

                  {packageDropdownOpen && (
                    <div className={styles.submenuList}>
                      {item.subItems.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          className={`${styles.submenuItem} ${isActive(sub.path) ? styles.submenuActive : ""}`}
                          onClick={() => {
                            navigate(sub.path);
                            if (isMobile) closeAllMenus();
                          }}
                        >
                          <span className={styles.submenuIcon}>{sub.icon}</span>
                          <span>{sub.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={item.id}
                className={`${styles.navItem} ${isActive(item.path) ? styles.active : ""}`}
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) closeAllMenus();
                }}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                {isActive(item.path) && (
                  <span className={styles.activeIndicator}></span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className={styles.sidebarFooter}>
          <button className={styles.logoutBtnSidebar} onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Mobile Dark Overlay */}
      {isMobile && (sidebarOpen || mobileDrawerOpen) && (
        <div className={styles.overlay} onClick={closeAllMenus} />
      )}

      {/* ================= MAIN CONTENT OUTLET ================= */}
      <main
        className={`${styles.mainContent} ${!sidebarOpen ? styles.expanded : ""}`}
      >
        <Outlet />
      </main>

      {/* ================= MOBILE BOTTOM NAVIGATION ================= */}
      <nav className={styles.bottomNav}>
        {navItems.slice(0, 4).map((item) => (
          <button
            key={item.id}
            className={`${styles.bottomNavItem} ${isActive(item.path) ? styles.active : ""}`}
            onClick={() => navigate(item.path)}
          >
            <span className={styles.bottomNavIcon}>{item.icon}</span>
            <span className={styles.bottomNavLabel}>{item.label}</span>
          </button>
        ))}
        <button className={styles.bottomNavItem} onClick={toggleMobileDrawer}>
          <span className={styles.bottomNavIcon}>📋</span>
          <span className={styles.bottomNavLabel}>More</span>
        </button>
      </nav>

      {/* ================= MOBILE DRAWER MENU ================= */}
      <div
        className={`${styles.mobileDrawer} ${mobileDrawerOpen ? styles.open : ""}`}
      >
        <div className={styles.drawerHeader}>
          <h3>Navigation Menu</h3>
          <button
            onClick={toggleMobileDrawer}
            className={styles.closeDrawerBtn}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <nav className={styles.drawerNav}>
          {navItems.slice(4).map((item) => {
            if (item.isDropdown) {
              return (
                <div key={item.id} className={styles.drawerSubmenuGroup}>
                  <div className={styles.drawerSubmenuHeader}>
                    <span>📦 {item.label}</span>
                  </div>
                  {item.subItems.map((sub) => (
                    <button
                      key={sub.id}
                      className={styles.drawerNavItem}
                      style={{ paddingLeft: "32px" }}
                      onClick={() => {
                        navigate(sub.path);
                        setMobileDrawerOpen(false);
                      }}
                    >
                      <span className={styles.drawerNavIcon}>{sub.icon}</span>
                      <span>{sub.label}</span>
                    </button>
                  ))}
                </div>
              );
            }

            return (
              <button
                key={item.id}
                className={styles.drawerNavItem}
                onClick={() => {
                  navigate(item.path);
                  setMobileDrawerOpen(false);
                }}
              >
                <span className={styles.drawerNavIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
          <div className={styles.drawerDivider}></div>
          <button className={styles.drawerNavItem} onClick={handleLogout}>
            <span className={styles.drawerNavIcon}>🚪</span>
            <span>Logout</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default MemberLayout;