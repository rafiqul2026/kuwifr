// client/src/components/layout/MemberLayout.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./MemberLayout.module.css";

// 🧭 FULL MEMBER NAVIGATION CONFIGURATION
const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "📊", path: "/member/dashboard" },
  { id: "profile", label: "Profile", icon: "👤", path: "/member/profile" },
  { id: "kyc", label: "KYC Verification", icon: "🪪", path: "/member/kyc" },
  { id: "wallet", label: "Wallet & Payouts", icon: "💰", path: "/member/wallet" },
  { id: "bonanza", label: "Bonanza Offers", icon: "🎯", path: "/member/bonanza" },
  { id: "repurchase", label: "Repurchase Store", icon: "🛍️", path: "/member/repurchase" },
  { id: "income", label: "Income Stream", icon: "📈", path: "/member/income" },
  { id: "team", label: "My Team", icon: "👥", path: "/member/team" },
  { id: "binary", label: "Binary Tree", icon: "🌳", path: "/member/binary" },
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
  { id: "ranks", label: "Ranks & Stars", icon: "🏆", path: "/member/ranks" },
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

  // Screen size detection
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

  // Lock body scroll when mobile drawer or full sidebar is active
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

  // Auto-close menus on page route changes
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
      {/* ================= TOP HEADER ================= */}
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
            <span className={styles.envTag}>Member</span>
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

      {/* ================= 📱 AIRTEL-INSPIRED FLOATING BOTTOM MENU ================= */}
      <div className={styles.bottomNavContainer}>
        <nav className={styles.bottomNavIsland}>
          {/* 1. Home */}
          <button
            type="button"
            className={`${styles.bottomNavItem} ${isActive("/member/dashboard") ? styles.bottomActive : ""}`}
            onClick={() => {
              navigate("/member/dashboard");
              closeAllMenus();
            }}
          >
            <div className={styles.iconCircle}>
              <svg className={styles.navSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <span className={styles.bottomNavLabel}>Home</span>
          </button>

          {/* 2. Income */}
          <button
            type="button"
            className={`${styles.bottomNavItem} ${isActive("/member/income") || isActive("/member/wallet") ? styles.bottomActive : ""}`}
            onClick={() => {
              navigate("/member/income");
              closeAllMenus();
            }}
          >
            <div className={styles.iconCircle}>
              <svg className={styles.navSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m0-6c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className={styles.bottomNavLabel}>Income</span>
          </button>

          {/* 3. My Team */}
          <button
            type="button"
            className={`${styles.bottomNavItem} ${isActive("/member/team") || isActive("/member/binary") ? styles.bottomActive : ""}`}
            onClick={() => {
              navigate("/member/team");
              closeAllMenus();
            }}
          >
            <div className={styles.iconCircle}>
              <svg className={styles.navSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span className={styles.bottomNavLabel}>My Team</span>
          </button>

          {/* 4. Buy Package */}
          <button
            type="button"
            className={`${styles.bottomNavItem} ${isPackageGroupActive ? styles.bottomActive : ""}`}
            onClick={() => {
              navigate("/member/packages");
              closeAllMenus();
            }}
          >
            <div className={styles.iconCircle}>
              <svg className={styles.navSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className={styles.bottomNavLabel}>Buy Package</span>
          </button>

          {/* 5. More */}
          <button
            type="button"
            className={`${styles.bottomNavItem} ${mobileDrawerOpen ? styles.bottomActive : ""}`}
            onClick={toggleMobileDrawer}
            aria-label="More Features"
          >
            <div className={styles.iconCircle}>
              <svg className={styles.navSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </div>
            <span className={styles.bottomNavLabel}>More</span>
          </button>
        </nav>
      </div>

     {/* ================= MOBILE BOTTOM DRAWER MENU ================= */}
      <div className={`${styles.mobileDrawer} ${mobileDrawerOpen ? styles.drawerOpen : ""}`}>
        {/* Mobile Pull Handle Indicator */}
        <div className={styles.drawerHandleBar}></div>

        <div className={styles.drawerHeader}>
          <div className={styles.drawerHeaderTitle}>
            <span className={styles.drawerPill}>KUWIFR Executive Hub</span>
            <h3>Quick Services</h3>
          </div>
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
          {navItems.map((item) => {
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
                      <span className={styles.drawerNavText}>{sub.label}</span>
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
                <span className={styles.drawerNavText}>{item.label}</span>
              </button>
            );
          })}

          <div className={styles.drawerDivider}></div>

          <button type="button" className={styles.drawerLogoutBtn} onClick={handleLogout}>
            <span className={styles.drawerNavIcon}>🚪</span>
            <span>Logout from Account</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default MemberLayout;