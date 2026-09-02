// client/src/pages/public/FAQPage.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './FAQPage.module.css';

const FAQ_CATEGORIES = [
  {
    category: 'Orders & Deliveries',
    icon: '🚚',
    items: [
      {
        question: 'How do I place an order on KUWIFR?',
        answer: 'Browse our catalog, select your desired item, choose the quantity, and click "Buy Now" or "Add to Bag". Enter your shipping details, select your preferred payment mode (UPI, Card, NetBanking, or COD), and complete the checkout.'
      },
      {
        question: 'What are the delivery timelines across India?',
        answer: 'Most metro orders are delivered within 3 to 6 business days. Non-metro regions and specialized shipments (such as Alkaline Water Devices or EV Scooties) take approximately 5 to 10 business days. Live tracking numbers are sent via SMS and Email upon dispatch.'
      },
      {
        question: 'Is Cash on Delivery (COD) available?',
        answer: 'Yes, Cash on Delivery is supported for select pin codes across India for orders up to ₹5,000, with a flat nominal convenience fee of ₹50.'
      },
      {
        question: 'How can I track my shipment?',
        answer: 'You can track your parcel in real-time by clicking the "Track Order" button in the website header or footer and entering your unique Order ID (e.g., ORD123456).'
      }
    ]
  },
  {
    category: 'Products & Quality Assurance',
    icon: '🌿',
    items: [
      {
        question: 'Are all products genuine and certified?',
        answer: 'Yes. Every wellness supplement, Himalayan Shilajit resin, beauty formulation, and electronic device on KUWIFR is 100% authentic, lab-tested, and sourced under strict quality-control protocols.'
      },
      {
        question: 'How do KUWIFR Alkaline Water Devices work?',
        answer: 'Our Alkaline Water Devices utilize advanced multi-stage ionization and mineralizing filters to enrich drinking water with essential antioxidants, balance pH levels, and neutralize acidic impurities.'
      },
      {
        question: 'Are herbal supplements safe for daily consumption?',
        answer: 'All our health products are formulated using non-toxic, standard nutritional ingredients. However, if you are pregnant, nursing, or undergoing specific medical treatment, we recommend consulting your healthcare physician.'
      }
    ]
  },
  {
    category: 'Payments & Security',
    icon: '💳',
    items: [
      {
        question: 'Which payment methods are accepted?',
        answer: 'We accept all major payment modes including UPI (Google Pay, PhonePe, Paytm), RuPay, Visa, MasterCard, NetBanking, and direct QR verification.'
      },
      {
        question: 'Is my card and transaction information secure?',
        answer: 'Yes. Our platform integrates certified 256-bit TLS/SSL encryption and PCI-DSS compliant payment gateways. We never store raw card numbers, CVVs, or personal banking passwords.'
      }
    ]
  },
  {
    category: 'Returns, Refunds & Warranty',
    icon: '🔄',
    items: [
      {
        question: 'What is the return and replacement policy?',
        answer: 'If you receive an item that is damaged in transit, defective, or incorrect, you can request a doorstep replacement or full refund within 48 hours of delivery by emailing support@kuwifr.com.'
      },
      {
        question: 'How long does it take to receive a refund?',
        answer: 'Once approved, refunds for prepaid orders are credited back to your original payment source within 5 to 7 working days. COD refunds are remitted via direct bank transfer within 7 to 10 working days.'
      }
    ]
  }
];

const FAQPage = () => {
  const [openCategory, setOpenCategory] = useState(0);
  const [openItem, setOpenItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleItem = (index) => {
    setOpenItem(openItem === index ? null : index);
  };

  const filteredCategories = FAQ_CATEGORIES.map(cat => ({
    ...cat,
    items: cat.items.filter(item => 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(cat => cat.items.length > 0);

  return (
    <div className={styles.faqPage}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.badge}>Help & Support</span>
          <h1 className={styles.title}>Frequently Asked Questions</h1>
          <p className={styles.subtitle}>
            Find quick answers to common questions about orders, payments, shipping, and product usage.
          </p>

          {/* Search Box */}
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="Search for questions (e.g. shipping, shilajit, returns, tracking)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* FAQ Category Accordions */}
        <div className={styles.faqContent}>
          {filteredCategories.length > 0 ? (
            filteredCategories.map((group, groupIndex) => (
              <div key={groupIndex} className={styles.categorySection}>
                <div className={styles.categoryHeader}>
                  <span className={styles.categoryIcon}>{group.icon}</span>
                  <h2>{group.category}</h2>
                </div>

                <div className={styles.accordionList}>
                  {group.items.map((item, itemIndex) => {
                    const uniqueKey = `${groupIndex}-${itemIndex}`;
                    const isOpen = openItem === uniqueKey;

                    return (
                      <div key={itemIndex} className={`${styles.accordionItem} ${isOpen ? styles.open : ''}`}>
                        <button 
                          className={styles.questionButton} 
                          onClick={() => toggleItem(uniqueKey)}
                          aria-expanded={isOpen}
                        >
                          <span className={styles.questionText}>{item.question}</span>
                          <span className={styles.toggleIcon}>{isOpen ? '−' : '+'}</span>
                        </button>
                        {isOpen && (
                          <div className={styles.answerWrapper}>
                            <p>{item.answer}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className={styles.noResults}>
              <span>🔍</span>
              <h3>No matching answers found</h3>
              <p>Try searching with different keywords or contact our support team directly.</p>
              <Link to="/contact" className={styles.contactBtn}>Contact Support</Link>
            </div>
          )}
        </div>

        {/* Still Have Questions Box */}
        <div className={styles.contactCard}>
          <div>
            <h3>Still need help?</h3>
            <p>Our dedicated support team is available Monday – Saturday, 9:30 AM to 6:30 PM.</p>
          </div>
          <Link to="/contact" className={styles.reachOutBtn}>
            Get in Touch
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FAQPage;