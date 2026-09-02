// client/src/components/public/WishlistSlideOver.jsx
import React from 'react';
import styles from './SlideOver.module.css';
import { useShop } from '../../context/ShopContext';

const WishlistSlideOver = () => {
  const { isWishlistOpen, setIsWishlistOpen, wishlist, toggleWishlist, addToCart } = useShop();

  if (!isWishlistOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.drawer}>
        <div className={styles.header}>
          <h3>Saved Items ({wishlist.length})</h3>
          <button className={styles.closeBtn} onClick={() => setIsWishlistOpen(false)}>✕</button>
        </div>

        <div className={styles.content}>
          {wishlist.length === 0 ? (
            <div className={styles.empty}>
              <span>♡</span>
              <p>You haven't saved any items yet.</p>
              <button className={styles.shopBtn} onClick={() => setIsWishlistOpen(false)}>
                Explore Products
              </button>
            </div>
          ) : (
            <div className={styles.itemList}>
              {wishlist.map((item) => (
                <div key={item.id} className={styles.item}>
                  <img src={item.image} alt={item.name} />
                  <div className={styles.itemInfo}>
                    <h4>{item.name}</h4>
                    <p className={styles.price}>₹{item.ksp.toLocaleString()}</p>
                    <button 
                      className={styles.moveToCartBtn}
                      onClick={() => {
                        addToCart(item);
                        toggleWishlist(item);
                      }}
                    >
                      Move to Bag
                    </button>
                  </div>
                  <button className={styles.removeBtn} onClick={() => toggleWishlist(item)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WishlistSlideOver;