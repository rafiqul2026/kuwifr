// client/src/context/ShopContext.jsx
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import api from '../services/api';

const ShopContext = createContext();

// Normalizes a RepurchaseProduct API document (the real, admin-managed
// catalog — GET /api/repurchase/products, images: [{url,publicId}]) into
// the flat shape every storefront component (ProductShowcase, ProductModal,
// Header search, CartSlideOver, WishlistSlideOver, ProductDetailPage)
// already expects. This is the single place that shape conversion happens,
// so the rest of the storefront never needs to know about the API's raw
// document shape.
const normalizeProduct = (p) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  categoryLabel: p.category,
  mrp: p.mrp,
  ksp: p.ksp,
  kbp: p.kbp,
  image: p.images?.[0]?.url || '',
  images: p.images || [],
  description: p.description || '',
  inStock: p.isActive !== false,
  tag: p.tag || ''
});

export const ShopProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('kuwifr_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState(() => {
    try {
      const saved = localStorage.getItem('kuwifr_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('ALL');

  // Real product catalog — previously the whole public storefront (Home,
  // Shop, product detail pages, cart, wishlist, header search) rendered a
  // hardcoded array of fabricated demo products with stock Unsplash photos
  // (client/src/constants/productsData.js), completely disconnected from
  // the real, admin-managed, photo-uploaded catalog that already powers the
  // Member Repurchase Store and Buy Package. Fetched once here so every
  // consumer sees the same live data.
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/repurchase/products');
        if (cancelled) return;
        const list = res.data?.data?.products || [];
        setProducts(list.map(normalizeProduct));
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Real categories actually present in the catalog — replaces the old
  // hardcoded 5-category list (HEALTH_SUPPLEMENT, WATER_PURIFIER, etc.)
  // that no longer matches this catalog's free-text category names, so
  // filtering never silently shows zero results for a stale category.
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products]
  );

  useEffect(() => {
    localStorage.setItem('kuwifr_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('kuwifr_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  const addToCart = (product, quantity = 1) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prevCart, { ...product, quantity }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId, delta) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const toggleWishlist = (product) => {
    setWishlist((prev) => {
      const exists = prev.find((item) => item.id === product.id);
      if (exists) {
        return prev.filter((item) => item.id !== product.id);
      }
      return [...prev, product];
    });
  };

  const clearCart = () => setCart([]);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartSubtotal = cart.reduce((total, item) => total + item.ksp * item.quantity, 0);
  const wishlistCount = wishlist.length;

  return (
    <ShopContext.Provider
      value={{
        cart,
        wishlist,
        cartCount,
        wishlistCount,
        cartSubtotal,
        isCartOpen,
        setIsCartOpen,
        isWishlistOpen,
        setIsWishlistOpen,
        activeCategoryFilter,
        setActiveCategoryFilter,
        addToCart,
        removeFromCart,
        updateQuantity,
        toggleWishlist,
        clearCart,
        products,
        productsLoading,
        categories
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => useContext(ShopContext);
