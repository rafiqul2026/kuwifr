// client/src/components/layout/Header.jsx
//
// Public site header (every storefront page). Styled with the Customer
// Panel's palette (see --kw-* tokens in styles/variables.css).
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { FiSearch, FiHeart, FiShoppingBag, FiUser, FiMenu, FiX, FiChevronDown, FiChevronRight, FiPackage, FiLogOut, FiGrid } from 'react-icons/fi';
import { useShop } from '../../context/ShopContext';
import { useAuth } from '../../context/AuthContext';
import { cdnImage } from '../../utils/imageUrl';
import styles from './Header.module.css';

const NAV_LINKS = [
  { label: 'Home', to: '/', end: true },
  { label: 'Shop', to: '/shop' },
  { label: 'About Us', to: '/about' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Contact', to: '/contact' }
];

// Orders are only visible to the signed-in member (there is no public
// order-lookup API), so "Track Order" opens My Orders — the login screen
// appears first when needed.
const TRACK_ORDER_PATH = '/member/orders';

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  const {
    products,
    categories = [],
    cartCount = 0,
    wishlistCount = 0,
    setIsCartOpen,
    setIsWishlistOpen,
    setActiveCategoryFilter
  } = useShop();
  const { user, isAuthenticated, logout } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef(null);
  const accountRef = useRef(null);
  const hamburgerRef = useRef(null);
  const drawerRef = useRef(null);

  const safeProducts = useMemo(() => (Array.isArray(products) ? products : []), [products]);

  // Real categories, most-stocked first, for the drawer's shortcuts.
  const topCategories = useMemo(() => {
    const counts = {};
    safeProducts.forEach((p) => {
      if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return categories.filter((c) => counts[c]).sort((a, b) => counts[b] - counts[a]).slice(0, 6);
  }, [categories, safeProducts]);

  const role = (user?.role || '').toUpperCase();
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const portalPath = !isAuthenticated ? '/login' : isAdmin ? '/admin/dashboard' : '/member/dashboard';
  const portalLabel = !isAuthenticated ? 'Customer Login' : isAdmin ? 'Admin Panel' : 'My Dashboard';

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return safeProducts
      .filter((p) => p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q))
      .slice(0, 5);
  }, [searchQuery, safeProducts]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menus on navigation.
  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setShowAccountDropdown(false);
    setSearchQuery('');
  }, [location.pathname, location.search]);

  // Click outside closes the search flyout and account menu.
  useEffect(() => {
    const onDown = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
      if (accountRef.current && !accountRef.current.contains(e.target)) setShowAccountDropdown(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Escape closes whatever is open.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (mobileMenuOpen) {
        setMobileMenuOpen(false);
        hamburgerRef.current?.focus();
      }
      setSearchOpen(false);
      setShowAccountDropdown(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  // Drawer: lock page scroll, move focus in, keep Tab inside.
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const drawer = drawerRef.current;
    drawer?.querySelector('button, a, input')?.focus();
    const trap = (e) => {
      if (e.key !== 'Tab' || !drawer) return;
      const els = drawer.querySelectorAll('a[href], button:not([disabled]), input');
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    drawer?.addEventListener('keydown', trap);
    return () => {
      document.body.style.overflow = prev;
      drawer?.removeEventListener('keydown', trap);
    };
  }, [mobileMenuOpen]);

  const closeDrawer = useCallback(() => {
    setMobileMenuOpen(false);
    hamburgerRef.current?.focus();
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/shop?search=${encodeURIComponent(q)}`);
  };

  const goToCategory = (cat) => {
    if (typeof setActiveCategoryFilter === 'function') setActiveCategoryFilter(cat);
    navigate(`/shop?category=${encodeURIComponent(cat)}`);
  };

  const handleLogout = () => {
    setShowAccountDropdown(false);
    setMobileMenuOpen(false);
    if (logout) logout();
    navigate('/login');
  };

  const searchForm = (id, autoFocus) => (
    <form onSubmit={submitSearch} className={styles.searchForm} role="search">
      <label htmlFor={id} className={styles.srOnly}>Search products</label>
      <FiSearch className={styles.searchIcon} aria-hidden="true" />
      <input
        id={id}
        type="search"
        placeholder="Search products…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className={styles.searchInput}
        autoComplete="off"
        autoFocus={autoFocus}
        enterKeyHint="search"
      />
    </form>
  );

  return (
    <>
      <a href="#main-content" className={styles.skipLink}>Skip to main content</a>

      {/* Shipping terms are the published Shipping Policy (/shipping-policy). */}
      <div className={styles.announcementBar}>
        <p>
          Free shipping on prepaid orders of ₹999 and above.{' '}
          <Link to="/shipping-policy">Shipping policy</Link>
        </p>
      </div>

      <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}>
        <div className={styles.inner}>
          <button
            ref={hamburgerRef}
            type="button"
            className={styles.hamburger}
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav"
          >
            <FiMenu aria-hidden="true" />
          </button>

          <Link to="/" className={styles.brand} aria-label="KUWIFR home">
            <img src="/logo-48.webp" srcSet="/logo-48.webp 1x, /logo-96.webp 2x" alt="KUWIFR" className={styles.logo} width="40" height="40" />
          </Link>

          <nav className={styles.desktopNav} aria-label="Main">
            {NAV_LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className={styles.actions}>
            <div className={styles.searchWrap} ref={searchRef}>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setSearchOpen((o) => !o)}
                aria-label="Search products"
                aria-expanded={searchOpen}
              >
                <FiSearch aria-hidden="true" />
              </button>
              {searchOpen && (
                <div className={styles.searchFlyout}>
                  {searchForm('header-search', true)}
                  {suggestions.length > 0 && (
                    <ul className={styles.suggestions} aria-label="Matching products">
                      {suggestions.map((p) => (
                        <li key={p.id || p._id}>
                          <Link to={`/product/${p.id || p._id}`} className={styles.suggestion}>
                            {p.image ? (
                              <img src={cdnImage(p.image, 80)} alt="" className={styles.suggestionThumb} loading="lazy" width="40" height="40" />
                            ) : (
                              <span className={styles.suggestionThumb} aria-hidden="true"><FiPackage /></span>
                            )}
                            <span className={styles.suggestionText}>
                              <span>{p.name}</span>
                              <small>₹{Number(p.ksp || 0).toLocaleString('en-IN')}</small>
                            </span>
                          </Link>
                        </li>
                      ))}
                      <li>
                        <button type="button" className={styles.viewAll} onClick={submitSearch}>
                          View all results <FiChevronRight aria-hidden="true" />
                        </button>
                      </li>
                    </ul>
                  )}
                  {searchQuery.trim().length >= 2 && suggestions.length === 0 && (
                    <p className={styles.noResults}>No products match “{searchQuery.trim()}”. Press Enter to search the shop.</p>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className={`${styles.iconBtn} ${styles.hideSm}`}
              onClick={() => setIsWishlistOpen && setIsWishlistOpen(true)}
              aria-label={`Wishlist, ${wishlistCount} item${wishlistCount === 1 ? '' : 's'}`}
            >
              <FiHeart aria-hidden="true" />
              {wishlistCount > 0 && <span className={styles.badge}>{wishlistCount}</span>}
            </button>

            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setIsCartOpen && setIsCartOpen(true)}
              aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
            >
              <FiShoppingBag aria-hidden="true" />
              {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
            </button>

            {/* Phones: one-tap access to Customer Login / dashboard */}
            <Link to={portalPath} className={`${styles.iconBtn} ${styles.showSmOnly}`} aria-label={portalLabel}>
              <FiUser aria-hidden="true" />
            </Link>

            {isAuthenticated ? (
              <div className={`${styles.account} ${styles.hideMd}`} ref={accountRef}>
                <button
                  type="button"
                  className={styles.accountBtn}
                  onClick={() => setShowAccountDropdown((o) => !o)}
                  aria-expanded={showAccountDropdown}
                  aria-haspopup="true"
                >
                  <span className={styles.avatar} aria-hidden="true">{(user?.fullName || 'U')[0].toUpperCase()}</span>
                  <span className={styles.accountName}>{user?.fullName?.split(' ')[0] || 'Account'}</span>
                  <FiChevronDown aria-hidden="true" />
                </button>
                {showAccountDropdown && (
                  <div className={styles.dropdown}>
                    <div className={styles.dropdownHead}>
                      <strong>{user?.fullName || 'Member'}</strong>
                      <small>{user?.memberId || role || 'MEMBER'}</small>
                    </div>
                    <Link to={portalPath} className={styles.dropdownItem}>
                      <FiGrid aria-hidden="true" /> {portalLabel}
                    </Link>
                    {!isAdmin && (
                      <Link to={TRACK_ORDER_PATH} className={styles.dropdownItem}>
                        <FiPackage aria-hidden="true" /> My Orders
                      </Link>
                    )}
                    <button type="button" className={`${styles.dropdownItem} ${styles.dropdownDanger}`} onClick={handleLogout}>
                      <FiLogOut aria-hidden="true" /> Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login" className={`${styles.loginBtn} ${styles.hideMd}`}>
                  <FiUser aria-hidden="true" /> Customer Login
                </Link>
                <Link to="/register" className={`${styles.ctaBtn} ${styles.hideLg}`}>
                  Join KUWIFR
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile / tablet drawer */}
      {mobileMenuOpen && (
        <div className={styles.overlay} onClick={closeDrawer}>
          <div
            id="mobile-nav"
            ref={drawerRef}
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.drawerHead}>
              <Link to="/" className={styles.brand} aria-label="KUWIFR home">
                <img src="/logo-48.webp" srcSet="/logo-48.webp 1x, /logo-96.webp 2x" alt="KUWIFR" className={styles.logo} width="40" height="40" />
              </Link>
              <button type="button" className={styles.iconBtn} onClick={closeDrawer} aria-label="Close menu">
                <FiX aria-hidden="true" />
              </button>
            </div>

            <div className={styles.drawerBody}>
              <div className={styles.drawerSearch}>{searchForm('drawer-search', false)}</div>

              <div className={styles.drawerAuth}>
                <Link to={portalPath} className={styles.drawerPrimary}>
                  {isAuthenticated ? <FiGrid aria-hidden="true" /> : <FiUser aria-hidden="true" />} {portalLabel}
                </Link>
                {!isAuthenticated && (
                  <Link to="/register" className={styles.drawerSecondary}>Join KUWIFR</Link>
                )}
              </div>

              <nav aria-label="Mobile">
                <p className={styles.drawerLabel}>Menu</p>
                <ul className={styles.drawerList}>
                  {NAV_LINKS.map((l) => (
                    <li key={l.to}>
                      <NavLink
                        to={l.to}
                        end={l.end}
                        className={({ isActive }) => `${styles.drawerLink} ${isActive ? styles.drawerLinkActive : ''}`}
                      >
                        {l.label} <FiChevronRight aria-hidden="true" />
                      </NavLink>
                    </li>
                  ))}
                </ul>

                {topCategories.length > 0 && (
                  <>
                    <p className={styles.drawerLabel}>Shop by category</p>
                    <ul className={styles.drawerList}>
                      {topCategories.map((cat) => (
                        <li key={cat}>
                          <button type="button" className={styles.drawerLink} onClick={() => goToCategory(cat)}>
                            {cat} <FiChevronRight aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <p className={styles.drawerLabel}>Your account</p>
                <ul className={styles.drawerList}>
                  <li>
                    <Link to={TRACK_ORDER_PATH} className={styles.drawerLink}>
                      <span><FiPackage aria-hidden="true" /> Track my orders</span> <FiChevronRight aria-hidden="true" />
                    </Link>
                  </li>
                  <li>
                    <button
                      type="button"
                      className={styles.drawerLink}
                      onClick={() => { setMobileMenuOpen(false); if (setIsWishlistOpen) setIsWishlistOpen(true); }}
                    >
                      <span><FiHeart aria-hidden="true" /> Wishlist ({wishlistCount})</span> <FiChevronRight aria-hidden="true" />
                    </button>
                  </li>
                  {isAuthenticated && (
                    <li>
                      <button type="button" className={`${styles.drawerLink} ${styles.dropdownDanger}`} onClick={handleLogout}>
                        <span><FiLogOut aria-hidden="true" /> Log out</span>
                      </button>
                    </li>
                  )}
                </ul>
              </nav>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
