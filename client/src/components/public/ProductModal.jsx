// client/src/components/public/ProductModal.jsx
//
// "Buy Now" from the public storefront. Real orders are placed from a
// KUWIFR account in the Repurchase Store (payment is verified there and a
// tax invoice is issued), so this hands the product and quantity over to
// that flow — signing in first when needed. It previously showed an
// "Order Placed Successfully" screen with a random order number while
// nothing was saved or sent anywhere.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { setRepurchasePrefill, REPURCHASE_PATH } from '../../utils/repurchasePrefill';
import styles from './ProductModal.module.css';

const ProductModal = ({ product, onClose }) => {
  const [quantity, setQuantity] = useState(1);
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes((user?.role || '').toUpperCase());

  const totalAmount = Number(product.ksp || 0) * quantity;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const goToOrder = () => {
    setRepurchasePrefill([{ id: product.id, quantity }]);
    onClose();
    navigate(REPURCHASE_PATH);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>

        <div className={styles.modalGrid}>
          <div className={styles.modalImg}>
            {product.image ? <img src={product.image} alt={product.name} /> : <span aria-hidden="true">🛍️</span>}
          </div>

          <div className={styles.modalInfo}>
            {(product.categoryLabel || product.category) && (
              <span className={styles.badge}>{product.categoryLabel || product.category}</span>
            )}
            <h2 id="product-modal-title">{product.name}</h2>
            {product.description && <p className={styles.modalDesc}>{product.description}</p>}

            <div className={styles.priceTag}>
              <span className={styles.modalKsp}>₹{Number(product.ksp || 0).toLocaleString('en-IN')}</span>
              {Number(product.mrp) > Number(product.ksp) && (
                <span className={styles.modalMrp}>₹{Number(product.mrp).toLocaleString('en-IN')}</span>
              )}
            </div>

            <div className={styles.qtyControl}>
              <span id="qty-label">Quantity:</span>
              <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>-</button>
              <span aria-live="polite" aria-labelledby="qty-label">{quantity}</span>
              <button type="button" aria-label="Increase quantity" onClick={() => setQuantity(Math.min(99, quantity + 1))}>+</button>
            </div>

            <div className={styles.modalTotal}>
              <span>Total Amount:</span>
              <strong>₹{totalAmount.toLocaleString('en-IN')}</strong>
            </div>

            <p className={styles.subtext}>
              Orders are placed from your KUWIFR account, so we can verify your payment and issue a tax invoice.
              {!isAuthenticated && ' Sign in (or join) and this product will be added to your order.'}
            </p>

            {isAdmin ? (
              <p className={styles.subtext}>You are signed in as an admin. Sign in with a member account to place orders.</p>
            ) : (
              <button type="button" className={styles.proceedBtn} onClick={goToOrder}>
                {isAuthenticated ? 'Continue to order' : 'Sign in to order'}
              </button>
            )}
            {!isAuthenticated && (
              <p className={styles.subtext}>
                New to KUWIFR? <Link to="/register" onClick={onClose}>Create an account</Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
