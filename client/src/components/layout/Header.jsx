// client/src/components/layout/Header.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useShop } from '../../context/ShopContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
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

  const {
    cartCount = 0,
    wishlistCount = 0,
    setIsCartOpen,
    setIsWishlistOpen,
    setActiveCategoryFilter
  } = useShop ? useShop() : {};

  const { user, isAuthenticated, logout } = useAuth
    ? useAuth()
    : { user: null, isAuthenticated: false, logout: () => {} };

  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef(null);
  const accountRef = useRef(null);

  // Elevation and compacting effect on scroll
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close modals & dropdowns on route changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setShowAccountDropdown(false);
    setSearchQuery('');
  }, [location.pathname, location.search]);

  // Handle click outside for search suggestions and account menu
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

  // Prevent background scroll when mobile drawer is open
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

  // Live search suggestions via API with safe debounce
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/api/products?search=${encodeURIComponent(searchQuery.trim())}&limit=5`);
        const payload = res.data?.data?.products || res.data?.products || (Array.isArray(res.data) ? res.data : []);
        setSearchSuggestions(payload.slice(0, 5));
      } catch (err) {
        setSearchSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  const handleCategoryNav = (categoryName) => {
    if (typeof setActiveCategoryFilter === 'function') {
      setActiveCategoryFilter(categoryName);
    }
    navigate(`/shop?category=${encodeURIComponent(categoryName)}`);
    setMobileMenuOpen(false);
  };

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Shop All', path: '/shop' },
    { label: 'Health & Wellness', category: 'Health & Wellness' },
    { label: 'Alkaline Tech', category: 'Alkaline Water Devices' },
    { label: 'Fashion & EV', category: 'Smart EV Scooty' },
  ];

  return (
    <>
      {/* 1. Full-Width Top Announcement Bar */}
      <div className={styles.announcementBar}>
        <div className={styles.announcementContainer}>
          <span className={styles.announcementText}>
            ✨ Free Express Shipping on All Orders Above ₹999 | 100% Genuine Guaranteed
          </span>
        </div>
      </div>

      {/* 2. Full-Width Sticky Two-Level Header */}
      <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}>
        <div className={styles.navContainer}>
          {/* Mobile Menu Hamburger Trigger */}
          <button
            className={styles.mobileHamburger}
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open Navigation Menu"
          >
            <span className={styles.hamburgerBar}></span>
            <span className={styles.hamburgerBar}></span>
            <span className={styles.hamburgerBar}></span>
          </button>

          {/* Left: Brand Logo */}
          <Link to="/" className={styles.brandLogo} aria-label="KUWIFR Home">
            <span className={styles.logoRocket}>🚀</span>
            <span className={styles.logoText}>KUWIFR</span>
          </Link>

          {/* Center: Desktop Navigation Links */}
          <nav className={styles.desktopNav} aria-label="Main Navigation">
            {navItems.map((item, idx) =>
              item.path ? (
                <NavLink
                  key={idx}
                  to={item.path}
                  className={({ isActive }) =>
                    `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                  }
                >
                  {item.label}
                </NavLink>
              ) : (
                <button
                  key={idx}
                  onClick={() => handleCategoryNav(item.category)}
                  className={styles.navItemBtn}
                >
                  {item.label}
                </button>
              )
            )}
          </nav>

          {/* Right: Search, Wishlist, Cart & Account Actions */}
          <div className={styles.actionGroup}>
            {/* Desktop / Tablet Expandable Search */}
            <div className={styles.searchWrapper} ref={searchRef}>
              {searchOpen ? (
                <div className={styles.searchFlyout}>
                  <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
                    <span className={styles.searchIconInside}>🔍</span>
                    <input
                      type="text"
                      placeholder="Search wellness, alkaline devices, sarees..."
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

                  {/* Live Search Suggestions Dropdown */}
                  {searchSuggestions.length > 0 && (
                    <div className={styles.suggestionsCard}>
                      <div className={styles.suggestionsHeader}>Products Matching Search</div>
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
                            src={prod.image || prod.images?.[0] || 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=100&q=80'}
                            alt={prod.name}
                            className={styles.suggestionThumb}
                          />
                          <div className={styles.suggestionInfo}>
                            <div className={styles.suggestionName}>{prod.name}</div>
                            <div className={styles.suggestionPrice}>₹{(prod.price || prod.sellingPrice || 0).toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={handleSearchSubmit}
                        className={styles.viewAllResultsBtn}
                      >
                        View all search results →
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
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Wishlist Button with Badge */}
            <button
              onClick={() => setIsWishlistOpen && setIsWishlistOpen(true)}
              className={styles.actionIconBtn}
              aria-label={`Wishlist (${wishlistCount} items)`}
              title="View Wishlist"
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {wishlistCount > 0 && (
                <span className={styles.countBadge}>{wishlistCount}</span>
              )}
            </button>

            {/* Cart Button with Badge */}
            <button
              onClick={() => setIsCartOpen && setIsCartOpen(true)}
              className={styles.actionIconBtn}
              aria-label={`Cart (${cartCount} items)`}
              title="View Cart"
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {cartCount > 0 && (
                <span className={styles.countBadge}>{cartCount}</span>
              )}
            </button>

            {/* Account / User Floating Card Menu */}
            <div className={styles.accountWrapper} ref={accountRef}>
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

              {/* Account Floating Card */}
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
                    {isAuthenticated && (
                      <Link
                        to={user?.role === 'ADMIN' ? '/admin' : '/dashboard'}
                        className={styles.dropdownItem}
                      >
                        <span>📊</span>
                        <span>{user?.role === 'ADMIN' ? 'Admin Portal' : 'Member Dashboard'}</span>
                      </Link>
                    )}

                    <button
                      onClick={() => {
                        setShowAccountDropdown(false);
                        if (setIsCartOpen) setIsCartOpen(true);
                      }}
                      className={styles.dropdownItem}
                    >
                      <span>🛍️</span>
                      <span>My Shopping Cart</span>
                      {cartCount > 0 && <span className={styles.itemCounter}>{cartCount}</span>}
                    </button>

                    <button
                      onClick={() => {
                        setShowAccountDropdown(false);
                        if (setIsWishlistOpen) setIsWishlistOpen(true);
                      }}
                      className={styles.dropdownItem}
                    >
                      <span>♡</span>
                      <span>My Wishlist</span>
                      {wishlistCount > 0 && <span className={styles.itemCounter}>{wishlistCount}</span>}
                    </button>

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

      {/* 3. Slide-In Full-Height Mobile Drawer */}
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
            {/* Drawer Header */}
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

            {/* Mobile Search Form */}
            <form onSubmit={handleSearchSubmit} className={styles.drawerSearchForm}>
              <input
                type="text"
                placeholder="Search products, alkaline devices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.drawerSearchInput}
              />
              <button type="submit" className={styles.drawerSearchSubmit} aria-label="Search">
                🔍
              </button>
            </form>

            {/* Drawer Navigation Links */}
            <div className={styles.drawerScrollBody}>
              <div className={styles.drawerSectionLabel}>Main Store</div>
              <NavLink
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `${styles.drawerNavLink} ${isActive ? styles.drawerNavLinkActive : ''}`
                }
              >
                <span>🏠 Home</span>
                <span className={styles.drawerArrow}>›</span>
              </NavLink>

              <NavLink
                to="/shop"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `${styles.drawerNavLink} ${isActive ? styles.drawerNavLinkActive : ''}`
                }
              >
                <span>🛍️ Shop All Products</span>
                <span className={styles.drawerArrow}>›</span>
              </NavLink>

              <div className={styles.drawerSectionLabel} style={{ marginTop: '20px' }}>
                Categories
              </div>
              <button
                onClick={() => handleCategoryNav('Health & Wellness')}
                className={styles.drawerCategoryBtn}
              >
                🌿 Health & Wellness
              </button>
              <button
                onClick={() => handleCategoryNav('Alkaline Water Devices')}
                className={styles.drawerCategoryBtn}
              >
                💧 Alkaline Water Devices
              </button>
              <button
                onClick={() => handleCategoryNav('Designer Modern Sarees')}
                className={styles.drawerCategoryBtn}
              >
                ✨ Designer Modern Sarees
              </button>
              <button
                onClick={() => handleCategoryNav('Gents Premium Wear')}
                className={styles.drawerCategoryBtn}
              >
                👔 Gents Premium Wear
              </button>
              <button
                onClick={() => handleCategoryNav('Smart EV Scooty')}
                className={styles.drawerCategoryBtn}
              >
                ⚡ Smart EV Scooty
              </button>
              <button
                onClick={() => handleCategoryNav('Hair Care & Serums')}
                className={styles.drawerCategoryBtn}
              >
                🧴 Hair Care & Serums
              </button>

              <div className={styles.drawerSectionLabel} style={{ marginTop: '20px' }}>
                Account & Orders
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowTracker(true);
                }}
                className={styles.drawerCategoryBtn}
              >
                📦 Track Your Order
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

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (setIsCartOpen) setIsCartOpen(true);
                }}
                className={styles.drawerCategoryBtn}
              >
                🛍️ My Cart ({cartCount})
              </button>
            </div>

            {/* Drawer Bottom Actions */}
            <div className={styles.drawerFooter}>
              <Link
                to={isAuthenticated ? (user?.role === 'ADMIN' ? '/admin' : '/dashboard') : '/login'}
                onClick={() => setMobileMenuOpen(false)}
                className={styles.drawerAuthBtn}
              >
                {isAuthenticated ? '👤 Access Portal / Account' : '🔐 Sign In / Register'}
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* 4. Connected Order Tracking Modal */}
      {showTracker && <OrderTrackingModal onClose={() => setShowTracker(false)} />}
    </>
  );
};

export default Header;