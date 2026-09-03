// client/src/components/layout/Navbar.jsx
import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Navbar.module.css';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { user, isAuthenticated } = useAuth ? useAuth() : { user: null, isAuthenticated: false };
  const navigate = useNavigate();
  const location = useLocation();

  // Sticky header shadow trigger
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close drawers on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
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

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setMobileMenuOpen(false);
      setSearchQuery('');
    }
  };

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'Shop All', path: '/shop' },
    { label: 'Health & Wellness', path: '/shop?category=Health+%26+Wellness' },
    { label: 'Alkaline Tech', path: '/shop?category=Alkaline+Water+Devices' },
    { label: 'Fashion & EV', path: '/shop?category=Smart+EV+Scooty' }
  ];

  return (
    <>
      {/* 1. Full-Width Top Announcement Bar */}
      <div className={styles.announcementBar}>
        <div className={styles.announcementContent}>
          <span>✨ Free Express Shipping on All Orders Above ₹999 | 100% Genuine Guaranteed</span>
        </div>
      </div>

      {/* 2. Full-Width Sticky Navbar */}
      <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}>
        <div className={styles.navFluidContainer}>
          {/* Mobile Hamburger Trigger */}
          <button
            className={styles.mobileToggleBtn}
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open Navigation"
          >
            <span className={styles.hamburgerLine}></span>
            <span className={styles.hamburgerLine}></span>
            <span className={styles.hamburgerLine}></span>
          </button>

          {/* Brand Logo */}
          <Link to="/" className={styles.brandLogo}>
            <span className={styles.rocketIcon}>🚀</span>
            <span className={styles.brandTitle}>KUWIFR</span>
          </Link>

          {/* Desktop Links (Centered & Full Breadth) */}
          <nav className={styles.desktopNavigation}>
            {navLinks.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right Action Icons */}
          <div className={styles.actionGroup}>
            {/* Search Toggle */}
            <div className={styles.searchWrapper}>
              {searchOpen ? (
                <form onSubmit={handleSearchSubmit} className={styles.searchFormActive}>
                  <input
                    type="text"
                    placeholder="Search products, alkaline tech..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles.searchDropdownInput}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setSearchOpen(false)}
                    className={styles.searchCancelBtn}
                  >
                    ✕
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  className={styles.iconButton}
                  aria-label="Search"
                  title="Search Store"
                >
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Wishlist */}
            <Link to="/wishlist" className={styles.iconButton} aria-label="Wishlist" title="Wishlist">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </Link>

            {/* Shopping Cart */}
            <Link to="/cart" className={styles.iconButton} aria-label="Cart" title="Shopping Cart">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </Link>

            {/* Account / Dashboard */}
            <Link
              to={isAuthenticated ? (user?.role === 'ADMIN' ? '/admin' : '/dashboard') : '/login'}
              className={styles.accountBtn}
              title={isAuthenticated ? 'Account Dashboard' : 'Sign In'}
            >
              <svg width="19" height="19" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className={styles.accountBtnText}>
                {isAuthenticated ? (user?.fullName?.split(' ')[0] || 'Account') : 'Sign In'}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* 3. Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className={styles.drawerBackdrop} onClick={() => setMobileMenuOpen(false)}>
          <div className={styles.drawerPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerTop}>
              <div className={styles.drawerLogo}>
                <span className={styles.rocketIcon}>🚀</span>
                <span className={styles.brandTitle}>KUWIFR</span>
              </div>
              <button
                className={styles.drawerClose}
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close Navigation"
              >
                ✕
              </button>
            </div>

            {/* Mobile Search Bar */}
            <form onSubmit={handleSearchSubmit} className={styles.drawerSearchBox}>
              <input
                type="text"
                placeholder="Search products, alkaline tech..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.drawerSearchInput}
              />
              <button type="submit" className={styles.drawerSearchBtn} aria-label="Search">
                🔍
              </button>
            </form>

            {/* Mobile Navigation Links */}
            <nav className={styles.drawerNav}>
              <span className={styles.drawerHeading}>Store Navigation</span>
              {navLinks.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `${styles.drawerItem} ${isActive ? styles.drawerItemActive : ''}`
                  }
                >
                  <span>{item.label}</span>
                  <span className={styles.chevron}>›</span>
                </NavLink>
              ))}

              <span className={styles.drawerHeading} style={{ marginTop: '16px' }}>
                All Categories
              </span>
              <Link to="/shop?category=Health+%26+Wellness" className={styles.drawerSubItem}>
                🌿 Health & Wellness
              </Link>
              <Link to="/shop?category=Alkaline+Water+Devices" className={styles.drawerSubItem}>
                💧 Alkaline Water Devices
              </Link>
              <Link to="/shop?category=Designer+Modern+Sarees" className={styles.drawerSubItem}>
                ✨ Designer Sarees
              </Link>
              <Link to="/shop?category=Gents+Premium+Wear" className={styles.drawerSubItem}>
                👔 Gents Premium Wear
              </Link>
              <Link to="/shop?category=Smart+EV+Scooty" className={styles.drawerSubItem}>
                ⚡ Smart EV Scooty
              </Link>
              <Link to="/shop?category=Hair+Care+%26+Serums" className={styles.drawerSubItem}>
                🧴 Hair Care & Serums
              </Link>
            </nav>

            {/* Drawer User Actions */}
            <div className={styles.drawerBottom}>
              <Link
                to={isAuthenticated ? '/dashboard' : '/login'}
                onClick={() => setMobileMenuOpen(false)}
                className={styles.drawerAuthBtn}
              >
                {isAuthenticated ? '👤 Go to My Account' : '🔐 Sign In / Register'}
              </Link>
              <div className={styles.drawerContactHint}>
                <span>Assam, India • Support: +91-9876543210</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;