// client/src/components/layout/MemberLayout.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  FiGrid,
  FiUser,
  FiCreditCard,
  FiDollarSign,
  FiTarget,
  FiShoppingBag,
  FiTrendingUp,
  FiUsers,
  FiBarChart2,
  FiGitBranch,
  FiPackage,
  FiShoppingCart,
  FiArrowUpCircle,
  FiClipboard,
  FiSend,
  FiAward,
  FiHome,
  FiBell,
  FiHeadphones,
  FiKey,
  FiLogOut,
  FiDownload,
  FiShare,
  FiPlusSquare,
  FiMoreVertical
} from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useInstallApp } from "../../utils/pwaInstall";
import styles from "./MemberLayout.module.css";

// 🧭 FULL MEMBER NAVIGATION CONFIGURATION (Profile configured as Collapsible Dropdown)
// Icons: a single standard set (Feather, via react-icons/fi) instead of the
// previous mixed-color platform emoji — every icon now renders in the same
// currentColor as its label (muted gray at rest, teal when active/hovered,
// exactly like the text), so the whole list reads as one consistent icon
// set instead of a jumble of different-colored glyphs.
const navItems = [
  { id: "dashboard", label: "Dashboard", icon: <FiGrid />, path: "/member/dashboard" },
  {
    id: "profile_group",
    label: "Profile",
    icon: <FiUser />,
    path: "/member/profile",
    isDropdown: true,
    subItems: [
      { id: "my_profile", label: "My Profile", icon: <FiUser />, path: "/member/profile" },
      { id: "kyc_verification", label: "KYC Verification", icon: <FiCreditCard />, path: "/member/kyc" }
    ]
  },
  { id: "wallet", label: "Wallet & Payouts", icon: <FiDollarSign />, path: "/member/wallet" },
  { id: "bonanza", label: "Bonanza Offers", icon: <FiTarget />, path: "/member/bonanza" },
  { id: "repurchase", label: "Repurchase Store", icon: <FiShoppingBag />, path: "/member/repurchase" },
  { id: "income", label: "Income Stream", icon: <FiTrendingUp />, path: "/member/income" },
  { id: "team", label: "My Team", icon: <FiUsers />, path: "/member/team" },
  { id: "business", label: "My Business", icon: <FiBarChart2 />, path: "/member/business" },
  { id: "growth_generation", label: "Growth Generation", icon: <FiGitBranch />, path: "/member/growth-generation" },
  {
    id: "package_group",
    label: "Package",
    icon: <FiPackage />,
    path: "/member/packages",
    isDropdown: true,
    subItems: [
      { id: "buy_package", label: "Buy Package", icon: <FiShoppingCart />, path: "/member/packages" },
      { id: "upgrade_package", label: "Upgrade Package", icon: <FiArrowUpCircle />, path: "/member/packages/upgrade" }
    ]
  },
  { id: "orders", label: "Orders", icon: <FiClipboard />, path: "/member/orders" },
  { id: "withdrawals", label: "Withdrawals", icon: <FiSend />, path: "/member/withdrawals" },
  { id: "ranks", label: "Rank and Rewards", icon: <FiAward />, path: "/member/ranks" },
  { id: "franchise", label: "Franchise", icon: <FiHome />, path: "/member/franchise" },
  { id: "notifications", label: "Notifications", icon: <FiBell />, path: "/member/notifications" },
  { id: "support", label: "Help & Support", icon: <FiHeadphones />, path: "/member/support" }
];

const MemberLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(true);
  const [packageDropdownOpen, setPackageDropdownOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Account dropdown (Account / Notifications / Change Password / Log out)
  // — replaces the sidebar footer's previous plain "Logout Account" button
  // with the same PBW-Foundation-style popover already used on the Admin
  // side (AdminLayout.jsx).
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const handleClickOutside = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [accountMenuOpen]);

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

  // Keep Profile dropdown expanded when visiting /member/profile or /member/kyc
  useEffect(() => {
    if (location.pathname.startsWith("/member/profile") || location.pathname.startsWith("/member/kyc")) {
      setProfileDropdownOpen(true);
    }
  }, [location.pathname]);

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

  // "Download the App" — installs KUWIFR as a PWA (see utils/pwaInstall.js).
  // Uses the browser's native install prompt when one is available; otherwise
  // (iPhone Safari, or a browser that hasn't offered it yet) shows how to add
  // it to the home screen manually. Hidden once running as the installed app.
  const { canPrompt, isInstalled, isIOS, promptInstall } = useInstallApp();
  const [installHelpOpen, setInstallHelpOpen] = useState(false);

  const handleInstallApp = async () => {
    closeAllMenus();
    if (canPrompt) {
      const outcome = await promptInstall();
      if (outcome !== "unavailable") return;
    }
    setInstallHelpOpen(true);
  };

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
  const isProfileGroupActive =
    location.pathname.startsWith("/member/profile") || location.pathname.startsWith("/member/kyc");
  const isPackageGroupActive = location.pathname.startsWith("/member/packages");

  return (
    <div className={styles.memberLayout}>
      {/* Blanket noindex for the entire private Member Portal — applies to
          every nested route rendered via <Outlet/> below in one place,
          since these pages must never be indexed or show up in search
          results (member IDs, wallet balances, team data, etc. must never
          be exposed through SEO metadata). */}
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Top Header */}
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
            <img src="/logo.jpg" alt="KUWIFR" className={styles.logoImg} />
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

      {/* Backdrop */}
      {isMobile && (sidebarOpen || mobileDrawerOpen) && (
        <div
          className={`${styles.overlay} ${styles.overlayVisible}`}
          onClick={closeAllMenus}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${styles.sidebar} ${sidebarOpen ? styles.open : ""}`}
        aria-label="Sidebar Navigation"
      >
        <div className={styles.sidebarInnerScroll}>
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

          <nav className={styles.sidebarNav}>
            {navItems.map((item) => {
              if (item.isDropdown) {
                const isGroupActive =
                  item.id === "profile_group" ? isProfileGroupActive : isPackageGroupActive;
                const isDropdownOpen =
                  item.id === "profile_group" ? profileDropdownOpen : packageDropdownOpen;
                const toggleDropdown = () => {
                  if (item.id === "profile_group") {
                    setProfileDropdownOpen((prev) => !prev);
                  } else {
                    setPackageDropdownOpen((prev) => !prev);
                  }
                };

                return (
                  <div key={item.id} className={styles.dropdownGroup}>
                    <button
                      type="button"
                      className={`${styles.navItem} ${isGroupActive ? styles.active : ""}`}
                      onClick={toggleDropdown}
                    >
                      <span className={styles.navIcon}>{item.icon}</span>
                      <span className={styles.navLabel}>{item.label}</span>
                      <span
                        className={`${styles.dropdownCaret} ${
                          isDropdownOpen ? styles.caretOpen : ""
                        }`}
                      >
                        ▼
                      </span>
                    </button>

                    {isDropdownOpen && (
                      <div className={styles.submenuList}>
                        {item.subItems.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            className={`${styles.submenuItem} ${
                              isActive(sub.path) ? styles.submenuActive : ""
                            }`}
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

          {!isInstalled && (
            <button type="button" className={styles.installAppBtn} onClick={handleInstallApp}>
              <span className={styles.installAppIcon}><FiDownload /></span>
              <span className={styles.installAppText}>
                <strong>Download the App</strong>
                <small>Install KUWIFR on this device</small>
              </span>
            </button>
          )}

          <div className={styles.sidebarFooter} ref={accountMenuRef}>
            <button
              type="button"
              className={styles.memberMetaBtn}
              onClick={() => setAccountMenuOpen((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={accountMenuOpen}
            >
              <div className={styles.memberMeta}>
                <div className={styles.memberMetaAvatar}>
                  {user?.profileImage?.url ? (
                    <img src={user.profileImage.url} alt={user.fullName || "User"} className={styles.avatarImg} />
                  ) : (
                    (user?.fullName || "M").charAt(0).toUpperCase()
                  )}
                </div>
                <div className={styles.memberMetaText}>
                  <div className={styles.memberMetaName}>{user?.fullName || "Member"}</div>
                  <span className={styles.memberMetaEmail}>{user?.email || (user?.memberId ? `ID: ${user.memberId}` : "")}</span>
                </div>
              </div>
              <span className={styles.accountMenuCaret}>{accountMenuOpen ? "▾" : "▴"}</span>
            </button>

            {accountMenuOpen && (
              <div className={styles.accountDropdown}>
                <div className={styles.accountDropdownHeader}>
                  <div className={styles.memberMetaAvatar}>
                    {user?.profileImage?.url ? (
                      <img src={user.profileImage.url} alt={user.fullName || "User"} className={styles.avatarImg} />
                    ) : (
                      (user?.fullName || "M").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className={styles.accountDropdownName}>{user?.fullName || "Member"}</div>
                    <div className={styles.accountDropdownEmail}>{user?.email || ""}</div>
                    <span className={styles.accountDropdownBadge}>{user?.memberId ? `ID: ${user.memberId}` : "MEMBER"}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.accountMenuItem}
                  onClick={() => {
                    setAccountMenuOpen(false);
                    navigate("/member/profile");
                  }}
                >
                  <span className={styles.accountMenuIcon}><FiUser /></span> Account
                </button>
                <button
                  type="button"
                  className={styles.accountMenuItem}
                  onClick={() => {
                    setAccountMenuOpen(false);
                    navigate("/member/notifications");
                  }}
                >
                  <span className={styles.accountMenuIcon}><FiBell /></span> Notifications
                </button>
                <button
                  type="button"
                  className={styles.accountMenuItem}
                  onClick={() => {
                    setAccountMenuOpen(false);
                    navigate("/member/profile", { state: { openChangePassword: true } });
                  }}
                >
                  <span className={styles.accountMenuIcon}><FiKey /></span> Change Password
                </button>
                <div className={styles.accountMenuDivider} />
                <button
                  type="button"
                  className={`${styles.accountMenuItem} ${styles.accountMenuItemDanger}`}
                  onClick={handleLogout}
                >
                  <span className={styles.accountMenuIcon}><FiLogOut /></span> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Outlet */}
      <main className={`${styles.mainContent} ${!sidebarOpen ? styles.expanded : ""}`}>
        <Outlet />
      </main>

      {/* Floating Bottom Navigation */}
      <div className={styles.bottomNavContainer}>
        <nav className={styles.bottomNavIsland}>
          {/* 1. Home */}
          <button
            type="button"
            className={`${styles.bottomNavItem} ${
              isActive("/member/dashboard") ? styles.bottomActive : ""
            }`}
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
            className={`${styles.bottomNavItem} ${
              isActive("/member/income") || isActive("/member/wallet") ? styles.bottomActive : ""
            }`}
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

          {/* 3. Growth Generation */}
          <button
            type="button"
            className={`${styles.bottomNavItem} ${
              isActive("/member/growth-generation") ? styles.bottomActive : ""
            }`}
            onClick={() => {
              navigate("/member/growth-generation");
              closeAllMenus();
            }}
          >
            <div className={styles.iconCircle}>
              <svg className={styles.navSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                <line x1="8" y1="2" x2="8" y2="18"></line>
                <line x1="16" y1="6" x2="16" y2="22"></line>
              </svg>
            </div>
            <span className={styles.bottomNavLabel}>Growth Gen</span>
          </button>

          {/* 4. Buy Package */}
          <button
            type="button"
            className={`${styles.bottomNavItem} ${
              isPackageGroupActive ? styles.bottomActive : ""
            }`}
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

      {/* Mobile Drawer Menu */}
      <div className={`${styles.mobileDrawer} ${mobileDrawerOpen ? styles.drawerOpen : ""}`}>
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
                    <span>{item.icon} {item.label}</span>
                  </div>
                  {item.subItems.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      className={`${styles.drawerNavItem} ${styles.drawerSubItem} ${
                        isActive(sub.path) ? styles.drawerActive : ""
                      }`}
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
                className={`${styles.drawerNavItem} ${
                  isActive(item.path) ? styles.drawerActive : ""
                }`}
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

          {!isInstalled && (
            <button type="button" className={styles.installAppBtn} onClick={handleInstallApp}>
              <span className={styles.installAppIcon}><FiDownload /></span>
              <span className={styles.installAppText}>
                <strong>Download the App</strong>
                <small>Install KUWIFR on your phone</small>
              </span>
            </button>
          )}

          <button type="button" className={styles.drawerLogoutBtn} onClick={handleLogout}>
            <span className={styles.drawerNavIcon}>🚪</span>
            <span>Logout from Account</span>
          </button>
        </nav>
      </div>

      {installHelpOpen && (
        <div
          className={styles.installModalOverlay}
          onClick={() => setInstallHelpOpen(false)}
          role="presentation"
        >
          <div
            className={styles.installModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-app-title"
            onClick={(e) => e.stopPropagation()}
          >
            <img src="/icons/icon-192.png" alt="KUWIFR" className={styles.installModalLogo} />
            <h3 id="install-app-title">Download the KUWIFR App</h3>
            {isIOS ? (
              <ol className={styles.installSteps}>
                <li>Open this page in <strong>Safari</strong>.</li>
                <li>Tap the <strong>Share</strong> button <FiShare aria-hidden="true" />.</li>
                <li>Choose <strong>Add to Home Screen</strong> <FiPlusSquare aria-hidden="true" />, then tap <strong>Add</strong>.</li>
              </ol>
            ) : (
              <ol className={styles.installSteps}>
                <li>Open this page in <strong>Chrome</strong> (or Edge / Samsung Internet).</li>
                <li>Tap the browser menu <FiMoreVertical aria-hidden="true" />.</li>
                <li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
              </ol>
            )}
            <p className={styles.installModalNote}>
              The KUWIFR icon will appear on your home screen and open like a normal app.
            </p>
            <button type="button" className={styles.installModalClose} onClick={() => setInstallHelpOpen(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberLayout;