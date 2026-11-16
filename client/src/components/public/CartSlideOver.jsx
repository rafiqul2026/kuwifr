// client/src/components/public/CartSlideOver.jsx
import React from 'react';
import styles from './SlideOver.module.css';
import { useShop } from '../../context/ShopContext';
import { useNavigate } from 'react-router-dom';
import { setRepurchasePrefill, REPURCHASE_PATH } from '../../utils/repurchasePrefill';

const CartSlideOver = () => {
  const { isCartOpen, setIsCartOpen, cart, updateQuantity, removeFromCart, cartSubtotal } = useShop();
  const navigate = useNavigate();

  // Real orders are placed in the member Repurchase Store (payment is
  // verified there). Hand the bag over to it; login comes first if needed.
  // This button used to just show alert('Proceeding to Secure Checkout').
  const handleCheckout = () => {
    setRepurchasePrefill(cart.map((item) => ({ id: item.id, quantity: item.quantity })));
    setIsCartOpen(false);
    navigate(REPURCHASE_PATH);
  };

  if (!isCartOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.drawer}>
        <div className={styles.header}>
          <h3>Your Cart ({cart.reduce((a, b) => a + b.quantity, 0)})</h3>
          <button className={styles.closeBtn} onClick={() => setIsCartOpen(false)}>✕</button>
        </div>

        <div className={styles.content}>
          {cart.length === 0 ? (
            <div className={styles.empty}>
              <span>🛍️</span>
              <p>Your shopping bag is currently empty.</p>
              <button className={styles.shopBtn} onClick={() => setIsCartOpen(false)}>
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className={styles.itemList}>
              {cart.map((item) => (
                <div key={item.id} className={styles.item}>
                  <img src={item.image} alt={item.name} />
                  <div className={styles.itemInfo}>
                    <h4>{item.name}</h4>
                    <p className={styles.price}>₹{item.ksp.toLocaleString()}</p>
                    <div className={styles.qtyRow}>
                      <button onClick={() => updateQuantity(item.id, -1)}>-</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)}>+</button>
                    </div>
                  </div>
                  <button className={styles.removeBtn} onClick={() => removeFromCart(item.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className={styles.footer}>
            <div className={styles.subtotalRow}>
              <span>Subtotal:</span>
              <strong>₹{cartSubtotal.toLocaleString()}</strong>
            </div>
            <button className={styles.checkoutBtn} onClick={handleCheckout}>
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartSlideOver;