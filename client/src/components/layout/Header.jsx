// client/src/components/layout/Header.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styles from './Header.module.css';
import { useShop } from '../../context/ShopContext';
import { KUWIFR_PRODUCTS } from '../../constants/productsData';
import OrderTrackingModal from '../public/OrderTrackingModal';

const Header = () => {
  const { 
    cartCount, 
    wishlistCount, 
    setIsCartOpen, 
    setIsWishlistOpen, 
    setActiveCategoryFilter 
  } = useShop();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showTracker, setShowTracker] = useState(false);

  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter products live as user types
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const results = KUWIFR_PRODUCTS.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleCategoryClick = (category) => {
    setActiveCategoryFilter(category);
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const el = document.getElementById('products');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById('products');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchOpen(false);
    handleCategoryClick('ALL');
  };

  return (
    <>
      <header className={styles.header}>
        {/* Top Announcement Bar */}
        <div className={styles.topStrip}>
          <span>✨ Free Express Shipping on All Orders Above ₹999 | 100% Genuine Guaranteed</span>
        </div>

        {/* Main Nav */}
        <div className={styles.mainNav}>
          <div className={styles.container}>
            {/* Logo */}
            <Link to="/" className={styles.logo} onClick={() => handleCategoryClick('ALL')}>
              <span className={styles.logoIcon}>🚀</span>
              <span className={styles.logoText}>KUWIFR</span>
            </Link>

            {/* Nav Menu */}
            <nav className={styles.navMenu}>
              <Link 
                to="/" 
                className={`${styles.navLink} ${location.pathname === '/' ? styles.active : ''}`}
                onClick={() => handleCategoryClick('ALL')}
              >
                Home
              </Link>
              <button 
                type="button" 
                className={styles.navLinkBtn}
                onClick={() => handleCategoryClick('ALL')}
              >
                Shop All
              </button>
              <button 
                type="button" 
                className={styles.navLinkBtn}
                onClick={() => handleCategoryClick('HEALTH_SUPPLEMENT')}
              >
                Health & Wellness
              </button>
              <button 
                type="button" 
                className={styles.navLinkBtn}
                onClick={() => handleCategoryClick('WATER_PURIFIER')}
              >
                Alkaline Tech
              </button>
              <button 
                type="button" 
                className={styles.navLinkBtn}
                onClick={() => handleCategoryClick('CLOTHING')}
              >
                Fashion & EV
              </button>
            </nav>

            {/* Action Buttons */}
            <div className={styles.actionIcons}>
              {/* Search Toggle */}
              <button 
                type="button"
                className={styles.iconBtn} 
                onClick={() => setSearchOpen(!searchOpen)} 
                title="Search"
                aria-label="Search Products"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>

              {/* Wishlist Drawer Trigger */}
              <button 
                type="button"
                className={styles.iconBtn} 
                onClick={() => setIsWishlistOpen(true)}
                title="Wishlist"
                aria-label="View Wishlist"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                {wishlistCount > 0 && <span className={styles.badge}>{wishlistCount}</span>}
              </button>

              {/* Cart Drawer Trigger */}
              <button 
                type="button"
                className={styles.iconBtn} 
                onClick={() => setIsCartOpen(true)}
                title="Shopping Bag"
                aria-label="View Cart"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
                {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
              </button>

              {/* User Dropdown */}
              <div className={styles.userMenuWrapper} ref={dropdownRef}>
                <button 
                  type="button"
                  className={`${styles.iconBtn} ${styles.userBtn}`} 
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  title="My Account"
                  aria-label="User Menu"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </button>

                {userDropdownOpen && (
                  <div className={styles.dropdownMenu}>
                    <div className={styles.dropdownHeader}>
                      <p>Welcome to KUWIFR</p>
                      <small>Manage your account & orders</small>
                    </div>
                    <div className={styles.dropdownDivider} />
                    <Link to="/login" className={styles.dropdownItem} onClick={() => setUserDropdownOpen(false)}>
                      <span className={styles.itemIcon}>➔</span> Sign In
                    </Link>
                    <Link to="/register" className={styles.dropdownItem} onClick={() => setUserDropdownOpen(false)}>
                      <span className={styles.itemIcon}>👤</span> Register
                    </Link>
                    <button 
                      type="button" 
                      className={styles.dropdownItemBtn} 
                      onClick={() => { setUserDropdownOpen(false); setIsCartOpen(true); }}
                    >
                      <span className={styles.itemIcon}>🛍️</span> My Cart ({cartCount})
                    </button>
                    <button 
                      type="button" 
                      className={styles.dropdownItemBtn} 
                      onClick={() => { setUserDropdownOpen(false); setIsWishlistOpen(true); }}
                    >
                      <span className={styles.itemIcon}>♡</span> My Wishlist ({wishlistCount})
                    </button>
                    <button 
                      type="button" 
                      className={styles.dropdownItemBtn} 
                      onClick={() => { setUserDropdownOpen(false); setShowTracker(true); }}
                    >
                      <span className={styles.itemIcon}>🚚</span> Track Your Order
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Search Bar */}
          {searchOpen && (
            <div className={styles.searchBarWrapper}>
              <div className={styles.container}>
                <form onSubmit={handleSearchSubmit} className={styles.searchInner}>
                  <input 
                    type="text" 
                    placeholder="Search for Shilajit, Protein, Alkaline Water, Sarees, Scooty..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus 
                  />
                  <button type="submit" className={styles.searchSubmitBtn}>Search</button>
                  <button 
                    type="button" 
                    className={styles.searchCloseBtn} 
                    onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                  >
                    ✕
                  </button>
                </form>

                {/* Instant Search Suggestions */}
                {searchResults.length > 0 && (
                  <div className={styles.searchDropdown}>
                    {searchResults.map((item) => (
                      <div 
                        key={item.id} 
                        className={styles.searchResultItem}
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchQuery('');
                          handleCategoryClick(item.category);
                        }}
                      >
                        <img src={item.image} alt={item.name} />
                        <div>
                          <strong>{item.name}</strong>
                          <small>₹{item.ksp.toLocaleString()}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Track Order Modal */}
      {showTracker && <OrderTrackingModal onClose={() => setShowTracker(false)} />}
    </>
  );
};

export default Header;