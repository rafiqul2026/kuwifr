// client/src/components/public/ProductModal.jsx
import React, { useState } from 'react';
import styles from './ProductModal.module.css';

const ProductModal = ({ product, onClose }) => {
  const [quantity, setQuantity] = useState(1);
  const [checkoutStep, setCheckoutStep] = useState('DETAILS');
  const [paymentMethod, setPaymentMethod] = useState('ONLINE');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    pincode: '',
    couponCode: ''
  });
  const [createdOrderNumber, setCreatedOrderNumber] = useState('');

  const totalAmount = product.ksp * quantity;

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleOrderSubmit = (e) => {
    e.preventDefault();
    const generatedOrderNo = 'ORD' + Math.floor(100000 + Math.random() * 900000);
    setCreatedOrderNumber(generatedOrderNo);
    setCheckoutStep('SUCCESS');
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>

        {checkoutStep === 'DETAILS' && (
          <div className={styles.modalGrid}>
            <div className={styles.modalImg}>
              <img src={product.image} alt={product.name} />
            </div>

            <div className={styles.modalInfo}>
              <span className={styles.badge}>{product.categoryLabel}</span>
              <h2>{product.name}</h2>
              <p className={styles.modalDesc}>{product.description}</p>

              <div className={styles.priceTag}>
                <span className={styles.modalKsp}>₹{product.ksp.toLocaleString()}</span>
                <span className={styles.modalMrp}>₹{product.mrp.toLocaleString()}</span>
                <span className={styles.kbp}>Free Express Delivery</span>
              </div>

              <div className={styles.qtyControl}>
                <span>Quantity:</span>
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
                <span>{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)}>+</button>
              </div>

              <div className={styles.modalTotal}>
                <span>Total Amount:</span>
                <strong>₹{totalAmount.toLocaleString()}</strong>
              </div>

              <button className={styles.proceedBtn} onClick={() => setCheckoutStep('FORM')}>
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}

        {checkoutStep === 'FORM' && (
          <form className={styles.checkoutForm} onSubmit={handleOrderSubmit}>
            <h3>Delivery & Payment Details</h3>
            <p className={styles.subtext}>
              Ordering: <strong>{product.name}</strong> (Qty: {quantity}) - Total: ₹{totalAmount.toLocaleString()}
            </p>

            <div className={styles.formGrid}>
              <input type="text" name="fullName" placeholder="Full Name *" required onChange={handleInputChange} />
              <input type="email" name="email" placeholder="Email Address *" required onChange={handleInputChange} />
              <input type="tel" name="phone" placeholder="10-Digit Mobile Number *" required pattern="[0-9]{10}" onChange={handleInputChange} />
              <input type="text" name="pincode" placeholder="Pincode *" required onChange={handleInputChange} />
              <textarea name="address" placeholder="Full Shipping Address *" className={styles.fullSpan} required onChange={handleInputChange}></textarea>
              <input type="text" name="couponCode" placeholder="Promo Code / Gift Voucher (Optional)" className={styles.fullSpan} onChange={handleInputChange} />
            </div>

            <div className={styles.paymentSelect}>
              <label>Select Payment Mode:</label>
              <div className={styles.paymentOptions}>
                <button
                  type="button"
                  className={paymentMethod === 'ONLINE' ? styles.activePay : ''}
                  onClick={() => setPaymentMethod('ONLINE')}
                >
                  💳 Razorpay / Cards / UPI (Instant)
                </button>
                <button
                  type="button"
                  className={paymentMethod === 'OFFLINE' ? styles.activePay : ''}
                  onClick={() => setPaymentMethod('OFFLINE')}
                >
                  📱 UPI QR / Manual Upload
                </button>
              </div>
            </div>

            <div className={styles.formActions}>
              <button type="button" className={styles.backBtn} onClick={() => setCheckoutStep('DETAILS')}>Back</button>
              <button type="submit" className={styles.confirmBtn}>Complete Order (₹{totalAmount.toLocaleString()})</button>
            </div>
          </form>
        )}

        {checkoutStep === 'SUCCESS' && (
          <div className={styles.successScreen}>
            <div className={styles.successIcon}>🎉</div>
            <h3>Order Placed Successfully!</h3>
            <p>Your Order Tracking ID is:</p>
            <div className={styles.orderNumberBadge}>{createdOrderNumber}</div>
            <p className={styles.subtext}>You can use this Order ID to track your parcel status anytime from the home page.</p>
            <button className={styles.proceedBtn} onClick={onClose}>Back to Store</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductModal;