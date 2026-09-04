// client/src/components/layout/MemberLayout.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./MemberLayout.module.css";

// ============================================================
// 🧭 MEMBER NAVIGATION STRUCTURE
// ============================================================
const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "📊", path: "/member/dashboard" },
  { id: "profile", label: "Profile", icon: "👤", path: "/member/profile" },
  { id: "kyc", label: "KYC Verification", icon: "🪪", path: "/member/kyc" },
  { id: "wallet", label: "Wallet", icon: "💰", path: "/member/wallet" },
  { id: "bonanza", label: "Bonanza", icon: "🎯", path: "/member/bonanza" },
  { id: "repurchase", label: "Repurchase", icon: "🛍️", path: "/member/repurchase" },
  { id: "income", label: "Income", icon: "📈", path: "/member/income" },
  { id: "team", label: "Team", icon: "👥", path: "/member/team" },
  { id: "binary", label: "Binary", icon: "🌳", path: "/member/binary" },
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
  { id: "orders", label: "Orders", icon: "🛒", path: "/member/orders" },
  { id: "withdrawals", label: "Withdrawals", icon: "💸", path: "/member/withdrawals" },
  { id: "ranks", label: "Ranks", icon: "🏆", path: "/member/ranks" },
  { id: "notifications", label: "Notifications", icon: "🔔", path: "/member/notifications" },
  { id: "support", label: "Help & Support", icon: "🎧", path: "/member/support" }
];

const MemberLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [packageDropdownOpen, setPackageDropdownOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Screen resize detection
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

  // Body scroll lock when mobile sidebar or bottom drawer is active
  useEffect(() => {
    const isMenuOpen = isMobile && (sidebarOpen || mobileDrawerOpen);
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [isMobile, sidebarOpen, mobileDrawerOpen]);

  // Close menus on page route changes
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
      setMobileDrawerOpen(false);
    }
  }, [location.pathname, isMobile]);

  const closeAllMenus = useCallback(() => {
    setSidebarOpen(false);
    setMobileDrawerOpen(false);
  }, []);

  const handleLogout = async () => {
    closeAllMenus();
    await logout();
    navigate("/");
  };

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
    if (mobileDrawerOpen) setMobileDrawerOpen(false);
  };

  const toggleMobileDrawer = () => {
    setMobileDrawerOpen((prev) => !prev);
    if (sidebarOpen) setSidebarOpen(false);
  };

  const isActive = (path) => location.pathname === path;
  const isPackageGroupActive = location.pathname.startsWith("/member/packages");

  return (
    <div className={styles.memberLayout}>
      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            className={styles.menuBtn}
            onClick={toggleSidebar}
            aria-label="Toggle navigation menu"
          >
            <span className={`${styles.menuIcon} ${sidebarOpen ? styles.menuIconActive : ""}`}></span>
          </button>
          <div
            className={styles.logo}
            onClick={() => navigate("/member/dashboard")}
            role="button"
            tabIndex={0}
          >
            <span className={styles.logoIcon}>🚀</span>
            <span className={styles.logoText}>KUWIFR</span>
            <span className={styles.envTag}>Cluster</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.notificationBtn}
            onClick={() => navigate("/member/notifications")}
            aria-label="Notifications"
          >
            🔔
            <span className={styles.notificationBadge}></span>
          </button>

          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.fullName || "Member"}</span>
            <span className={styles.userRole}>ID: {user?.memberId || "KFR------"}</span>
          </div>

          <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* ================= BACKDROP OVERLAY ================= */}
      {isMobile && (sidebarOpen || mobileDrawerOpen) && (
        <div
          className={`${styles.overlay} ${styles.overlayVisible}`}
          onClick={closeAllMenus}
          aria-hidden="true"
        />
      )}

      {/* ================= SIDEBAR (DESKTOP + MOBILE SLIDE-OUT) ================= */}
      <aside
        className={`${styles.sidebar} ${sidebarOpen ? styles.open : ""}`}
        aria-label="Sidebar Navigation"
      >
        <div className={styles.sidebarInnerScroll}>
          {/* User Profile Card */}
          <div className={styles.sidebarUser}>
            <div className={styles.sidebarAvatar}>
              {user?.profileImage?.url ? (
                <img
                  src={user.profileImage.url}
                  alt={user.fullName || "User"}
                  className={styles.avatarImg}
                />
              ) : (
                user?.fullName?.charAt(0) || "M"
              )}
            </div>
            <div className={styles.sidebarUserInfo}>
              <span className={styles.sidebarUserName}>{user?.fullName || "Member"}</span>
              <span className={styles.sidebarUserRole}>
                {user?.memberId ? `ID: ${user.memberId}` : "Active Member"}
              </span>
            </div>
          </div>

          {/* Nav Items */}
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
                      <span className={`${styles.dropdownCaret} ${packageDropdownOpen ? styles.caretOpen : ""}`}>
                        ▼
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
                  type="button"
                  className={`${styles.navItem} ${isActive(item.path) ? styles.active : ""}`}
                  onClick={() => {
                    navigate(item.path);
                    if (isMobile) closeAllMenus();
                  }}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span className={styles.navLabel}>{item.label}</span>
                  {isActive(item.path) && <span className={styles.activePill}></span>}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer Logout */}
          <div className={styles.sidebarFooter}>
            <button type="button" className={styles.logoutBtnSidebar} onClick={handleLogout}>
              <span>🚪</span>
              <span>Logout Account</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ================= MAIN CONTENT OUTLET ================= */}
      <main className={`${styles.mainContent} ${!sidebarOpen ? styles.expanded : ""}`}>
        <Outlet />
      </main>

      {/* ================= MOBILE BOTTOM NAVIGATION ================= */}
      <nav className={styles.bottomNav}>
        {navItems.slice(0, 4).map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.bottomNavItem} ${isActive(item.path) ? styles.bottomActive : ""}`}
            onClick={() => {
              navigate(item.path);
              closeAllMenus();
            }}
          >
            <span className={styles.bottomNavIcon}>{item.icon}</span>
            <span className={styles.bottomNavLabel}>{item.label}</span>
          </button>
        ))}

        <button
          type="button"
          className={`${styles.bottomNavItem} ${mobileDrawerOpen ? styles.bottomActive : ""}`}
          onClick={toggleMobileDrawer}
          aria-label="More Navigation"
        >
          <span className={styles.bottomNavIcon}>📋</span>
          <span className={styles.bottomNavLabel}>More</span>
        </button>
      </nav>

      {/* ================= MOBILE BOTTOM DRAWER MENU ================= */}
      <div className={`${styles.mobileDrawer} ${mobileDrawerOpen ? styles.drawerOpen : ""}`}>
        <div className={styles.drawerHeader}>
          <h3>All Navigation</h3>
          <button
            type="button"
            onClick={toggleMobileDrawer}
            className={styles.closeDrawerBtn}
            aria-label="Close Drawer"
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
                      type="button"
                      className={`${styles.drawerNavItem} ${styles.drawerSubItem} ${isActive(sub.path) ? styles.drawerActive : ""}`}
                      onClick={() => {
                        navigate(sub.path);
                        closeAllMenus();
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
                type="button"
                className={`${styles.drawerNavItem} ${isActive(item.path) ? styles.drawerActive : ""}`}
                onClick={() => {
                  navigate(item.path);
                  closeAllMenus();
                }}
              >
                <span className={styles.drawerNavIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className={styles.drawerDivider}></div>

          <button type="button" className={styles.drawerLogoutBtn} onClick={handleLogout}>
            <span className={styles.drawerNavIcon}>🚪</span>
            <span>Logout</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default MemberLayout;