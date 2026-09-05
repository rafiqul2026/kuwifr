// client/src/components/layout/Header.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useShop } from '../../context/ShopContext';
import { useAuth } from '../../context/AuthContext';
import OrderTrackingModal from '../public/OrderTrackingModal';
import styles from './Header.module.css';

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showTracker, setShowTracker] = useState(false);

  const shopContext = useShop ? useShop() : {};
  const {
    products,
    cartCount = 0,
    wishlistCount = 0,
    setIsCartOpen,
    setIsWishlistOpen,
    setActiveCategoryFilter,
    activeCategoryFilter = 'ALL'
  } = shopContext;

  // Stabilize products array reference to prevent infinite re-renders
  const safeProducts = useMemo(() => {
    return Array.isArray(products) ? products : [];
  }, [products]);

  const { user, isAuthenticated, logout } = useAuth
    ? useAuth()
    : { user: null, isAuthenticated: false, logout: () => {} };

  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef(null);
  const accountRef = useRef(null);

  // Compute exact destination URL according to authentication state & user role
  const portalPath = useMemo(() => {
    if (!isAuthenticated) return '/login';
    const role = (user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return '/admin/dashboard';
    return '/member/dashboard';
  }, [isAuthenticated, user]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close drawers & clean queries on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setShowAccountDropdown(false);
    setSearchQuery('');
    setSearchSuggestions([]);
  }, [location.pathname]);

  // Click outside to dismiss menus
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchSuggestions([]);
      }
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setShowAccountDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Live search filtering with stable dependencies
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length >= 2) {
      const matches = safeProducts
        .filter(
          (p) =>
            p.name?.toLowerCase().includes(q) ||
            p.category?.toLowerCase().includes(q)
        )
        .slice(0, 5);
      setSearchSuggestions(matches);
    } else {
      setSearchSuggestions([]);
    }
  }, [searchQuery, safeProducts]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setMobileMenuOpen(false);
      setSearchSuggestions([]);
      setSearchQuery('');
    }
  };

  const handleNavClick = (categoryName) => {
    if (typeof setActiveCategoryFilter === 'function') {
      setActiveCategoryFilter(categoryName);
    }
    setMobileMenuOpen(false);

    if (location.pathname === '/') {
      const el = document.getElementById('products');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }

    if (categoryName === 'ALL') {
      navigate('/shop');
    } else {
      navigate(`/shop?category=${encodeURIComponent(categoryName)}`);
    }
  };

  const navItems = [
    { label: 'Home', action: () => navigate('/') },
    { label: 'Shop All', action: () => handleNavClick('ALL'), key: 'ALL' },
    { label: 'Health & Wellness', action: () => handleNavClick('Health & Wellness'), key: 'Health & Wellness' },
    { label: 'Alkaline Tech', action: () => handleNavClick('Alkaline Water Devices'), key: 'Alkaline Water Devices' },
    { label: 'Fashion & EV', action: () => handleNavClick('Smart EV Scooty'), key: 'Smart EV Scooty' },
  ];

  return (
    <>
      {/* 1. Top Announcement Bar */}
      <div className={styles.announcementBar}>
        <div className={styles.announcementText}>
          ✨ Free Express Shipping on All Orders Above ₹999 | 100% Genuine Guaranteed
        </div>
      </div>

      {/* 2. Full-Width Header */}
      <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}>
        <div className={styles.navContainer}>
          <div className={styles.navLeft}>
            <button
              className={styles.mobileHamburger}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Navigation Menu"
            >
              <span className={styles.hamburgerBar}></span>
              <span className={styles.hamburgerBar}></span>
              <span className={styles.hamburgerBar}></span>
            </button>

            <Link to="/" className={styles.brandLogo} aria-label="KUWIFR Home">
              <span className={styles.logoRocket}>🚀</span>
              <span className={styles.logoText}>KUWIFR</span>
            </Link>
          </div>

          <nav className={styles.desktopNav} aria-label="Main Navigation">
            {navItems.map((item, idx) => (
              <button
                key={idx}
                onClick={item.action}
                className={`${styles.navItemBtn} ${
                  (item.key && activeCategoryFilter === item.key) ||
                  (item.label === 'Home' && location.pathname === '/')
                    ? styles.navItemActive
                    : ''
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className={styles.actionGroup}>
            {/* Search */}
            <div className={styles.searchWrapper} ref={searchRef}>
              {searchOpen ? (
                <div className={styles.searchFlyout}>
                  <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
                    <span className={styles.searchIconInside}>🔍</span>
                    <input
                      type="text"
                      placeholder="Search store..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={styles.searchInput}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchSuggestions([]);
                      }}
                      className={styles.searchCloseBtn}
                      aria-label="Close search"
                    >
                      ✕
                    </button>
                  </form>

                  {searchSuggestions.length > 0 && (
                    <div className={styles.suggestionsCard}>
                      <div className={styles.suggestionsHeader}>Matching Products</div>
                      {searchSuggestions.map((prod) => (
                        <div
                          key={prod.id || prod._id}
                          className={styles.suggestionRow}
                          onClick={() => {
                            navigate(`/product/${prod.id || prod._id}`);
                            setSearchOpen(false);
                            setSearchSuggestions([]);
                          }}
                        >
                          <img
                            src={
                              prod.image ||
                              prod.images?.[0] ||
                              'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=100&q=80'
                            }
                            alt={prod.name}
                            className={styles.suggestionThumb}
                          />
                          <div className={styles.suggestionInfo}>
                            <div className={styles.suggestionName}>{prod.name}</div>
                            <div className={styles.suggestionPrice}>
                              ₹{(prod.price || prod.sellingPrice || 0).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={handleSearchSubmit}
                        className={styles.viewAllResultsBtn}
                      >
                        View all results →
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  className={styles.actionIconBtn}
                  aria-label="Search"
                  title="Search Store"
                >
                  <svg width="21" height="21" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Wishlist */}
            <button
              onClick={() => setIsWishlistOpen && setIsWishlistOpen(true)}
              className={`${styles.actionIconBtn} ${styles.desktopOnlyIcon}`}
              aria-label={`Wishlist (${wishlistCount} items)`}
              title="View Wishlist"
            >
              <svg width="21" height="21" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {wishlistCount > 0 && <span className={styles.countBadge}>{wishlistCount}</span>}
            </button>

            {/* Cart */}
            <button
              onClick={() => setIsCartOpen && setIsCartOpen(true)}
              className={styles.actionIconBtn}
              aria-label={`Cart (${cartCount} items)`}
              title="View Cart"
            >
              <svg width="21" height="21" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {cartCount > 0 && <span className={styles.countBadge}>{cartCount}</span>}
            </button>

            {/* Account Trigger & Dropdown */}
            <div className={`${styles.accountWrapper} ${styles.desktopOnlyIcon}`} ref={accountRef}>
              <button
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className={styles.accountTrigger}
                aria-expanded={showAccountDropdown}
                aria-label="Account Menu"
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className={styles.accountLabel}>
                  {isAuthenticated ? (user?.fullName?.split(' ')[0] || 'Account') : 'Sign In'}
                </span>
                <span className={styles.dropdownCaret}>▾</span>
              </button>

              {showAccountDropdown && (
                <div className={styles.accountDropdownCard}>
                  <div className={styles.accountCardHeader}>
                    <span className={styles.welcomeText}>Welcome to KUWIFR</span>
                    <p className={styles.welcomeSub}>Manage your account, orders & tracking</p>
                  </div>

                  {!isAuthenticated ? (
                    <div className={styles.authActionRow}>
                      <Link to="/login" className={styles.loginCardBtn}>
                        Sign In
                      </Link>
                      <Link to="/register" className={styles.registerCardBtn}>
                        Register
                      </Link>
                    </div>
                  ) : (
                    <div className={styles.userProfilePill}>
                      <div className={styles.userInitials}>
                        {(user?.fullName || 'U')[0].toUpperCase()}
                      </div>
                      <div className={styles.userDetails}>
                        <div className={styles.userNameText}>{user?.fullName || 'Distributor'}</div>
                        <span className={styles.userRoleText}>{user?.role || 'MEMBER'}</span>
                      </div>
                    </div>
                  )}

                  <div className={styles.cardDivider}></div>

                  <div className={styles.dropdownMenuList}>
                    <Link
                      to={portalPath}
                      className={styles.dropdownItem}
                      onClick={() => setShowAccountDropdown(false)}
                    >
                      <span>📊</span>
                      <span>
                        {!isAuthenticated
                          ? 'Sign In / Member Portal'
                          : user?.role === 'ADMIN'
                          ? 'Admin Portal'
                          : 'Member Dashboard'}
                      </span>
                    </Link>

                    <button
                      onClick={() => {
                        setShowAccountDropdown(false);
                        setShowTracker(true);
                      }}
                      className={styles.dropdownItem}
                    >
                      <span>📦</span>
                      <span>Track Your Order</span>
                    </button>

                    {isAuthenticated && (
                      <>
                        <div className={styles.cardDivider}></div>
                        <button
                          onClick={() => {
                            if (logout) logout();
                            setShowAccountDropdown(false);
                            navigate('/login');
                          }}
                          className={`${styles.dropdownItem} ${styles.logoutItem}`}
                        >
                          <span>🚪</span>
                          <span>Log Out</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 3. Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          className={styles.drawerOverlay}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        >
          <aside
            className={styles.drawerSidebar}
            onClick={(e) => e.stopPropagation()}
            aria-label="Mobile Navigation"
          >
            <div className={styles.drawerHeader}>
              <Link to="/" className={styles.brandLogo} onClick={() => setMobileMenuOpen(false)}>
                <span className={styles.logoRocket}>🚀</span>
                <span className={styles.brandTitle}>KUWIFR</span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className={styles.drawerCloseBtn}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSearchSubmit} className={styles.drawerSearchForm}>
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.drawerSearchInput}
              />
              <button type="submit" className={styles.drawerSearchSubmit} aria-label="Search">
                🔍
              </button>
            </form>

            <div className={styles.drawerScrollBody}>
              <div className={styles.drawerSectionLabel}>Main Store</div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/');
                }}
                className={styles.drawerNavLink}
              >
                <span>🏠 Home</span>
                <span className={styles.drawerArrow}>›</span>
              </button>

              <button
                onClick={() => handleNavClick('ALL')}
                className={styles.drawerNavLink}
              >
                <span>🛍️ Shop All Products</span>
                <span className={styles.drawerArrow}>›</span>
              </button>

              <div className={styles.drawerSectionLabel} style={{ marginTop: '18px' }}>
                Featured Collections
              </div>
              <button
                onClick={() => handleNavClick('Health & Wellness')}
                className={styles.drawerCategoryBtn}
              >
                🌿 Health & Wellness
              </button>
              <button
                onClick={() => handleNavClick('Alkaline Water Devices')}
                className={styles.drawerCategoryBtn}
              >
                💧 Alkaline Water Devices
              </button>
              <button
                onClick={() => handleNavClick('Designer Modern Sarees')}
                className={styles.drawerCategoryBtn}
              >
                ✨ Designer Modern Sarees
              </button>
              <button
                onClick={() => handleNavClick('Gents Premium Wear')}
                className={styles.drawerCategoryBtn}
              >
                👔 Gents Premium Wear
              </button>
              <button
                onClick={() => handleNavClick('Smart EV Scooty')}
                className={styles.drawerCategoryBtn}
              >
                ⚡ Smart EV Scooty
              </button>
              <button
                onClick={() => handleNavClick('Hair Care & Serums')}
                className={styles.drawerCategoryBtn}
              >
                🧴 Hair Care & Serums
              </button>

              <div className={styles.drawerSectionLabel} style={{ marginTop: '18px' }}>
                User Services
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowTracker(true);
                }}
                className={styles.drawerCategoryBtn}
              >
                📦 Track Order
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (setIsWishlistOpen) setIsWishlistOpen(true);
                }}
                className={styles.drawerCategoryBtn}
              >
                ♡ My Wishlist ({wishlistCount})
              </button>

              {/* Login / Portal CTA Button */}
              <div className={styles.drawerAuthInlineWrapper}>
                <Link
                  to={portalPath}
                  onClick={() => setMobileMenuOpen(false)}
                  className={styles.drawerAuthBtn}
                >
                  {isAuthenticated
                    ? user?.role === 'ADMIN'
                      ? '🛡️ Access Admin Portal'
                      : '👤 Access Member Dashboard'
                    : '🔐 Login / Access Account'}
                </Link>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* 4. Order Tracking Modal */}
      {showTracker && <OrderTrackingModal onClose={() => setShowTracker(false)} />}
    </>
  );
};

export default Header;