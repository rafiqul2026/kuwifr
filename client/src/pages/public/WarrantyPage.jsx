import React from 'react';

const WarrantyPage = () => {
  return (
    <div style={{ padding: '100px 20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '36px', marginBottom: '20px' }}>Warranty Information</h1>
      <p style={{ fontSize: '18px', color: '#64748b', marginBottom: '40px' }}>Product Warranty Details</p>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '15px' }}>Product Warranty</h2>
        <p style={{ fontSize: '16px', lineHeight: '1.8', color: '#64748b' }}>
          Each product comes with a warranty as specified in the product description. 
          Warranty periods vary by product category.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '15px' }}>Warranty Coverage</h2>
        <ul style={{ paddingLeft: '20px' }}>
          <li style={{ fontSize: '16px', lineHeight: '1.8', color: '#64748b', marginBottom: '8px' }}>
            Manufacturing defects
          </li>
          <li style={{ fontSize: '16px', lineHeight: '1.8', color: '#64748b', marginBottom: '8px' }}>
            Product malfunctions under normal use
          </li>
          <li style={{ fontSize: '16px', lineHeight: '1.8', color: '#64748b', marginBottom: '8px' }}>
            Defective components
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '15px' }}>How to Claim Warranty</h2>
        <ol style={{ paddingLeft: '20px' }}>
          <li style={{ fontSize: '16px', lineHeight: '1.8', color: '#64748b', marginBottom: '8px' }}>
            Contact our customer support with your order details
          </li>
          <li style={{ fontSize: '16px', lineHeight: '1.8', color: '#64748b', marginBottom: '8px' }}>
            Provide proof of purchase (order number)
          </li>
          <li style={{ fontSize: '16px', lineHeight: '1.8', color: '#64748b', marginBottom: '8px' }}>
            Describe the issue with the product
          </li>
          <li style={{ fontSize: '16px', lineHeight: '1.8', color: '#64748b', marginBottom: '8px' }}>
            Our team will guide you through the process
          </li>
        </ol>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '15px' }}>What's Not Covered</h2>
        <ul style={{ paddingLeft: '20px' }}>
          <li style={{ fontSize: '16px', lineHeight: '1.8', color: '#64748b', marginBottom: '8px' }}>
            Damage from misuse or accidents
          </li>
          <li style={{ fontSize: '16px', lineHeight: '1.8', color: '#64748b', marginBottom: '8px' }}>
            Normal wear and tear
          </li>
          <li style={{ fontSize: '16px', lineHeight: '1.8', color: '#64748b', marginBottom: '8px' }}>
            Unauthorized repairs or modifications
          </li>
          <li style={{ fontSize: '16px', lineHeight: '1.8', color: '#64748b', marginBottom: '8px' }}>
            Products purchased from unauthorized sellers
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '15px' }}>Warranty Period</h2>
        <ul style={{ paddingLeft: '20px' }}>
          <li style={{ fontSize: '16px', lineHeight: '1.8', color: '#64748b', marginBottom: '8px' }}>
            <strong>Electronics:</strong> 1 year
          </li>
          <li style={{ fontSize: '16px', lineHeight: '1.8', color: '#64748b', marginBottom: '8px' }}>
            <strong>Clothing:</strong> 30 days
          </li>
          <li style={{ fontSize: '16px', lineHeight: '1.8', color: '#64748b', marginBottom: '8px' }}>
            <strong>Health Supplements:</strong> 15 days
          </li>
          <li style={{ fontSize: '16px', lineHeight: '1.8', color: '#64748b', marginBottom: '8px' }}>
            <strong>Other Products:</strong> As specified in product description
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '15px' }}>Contact for Warranty</h2>
        <p style={{ fontSize: '16px', lineHeight: '1.8', color: '#64748b' }}>
          For warranty claims, contact us at:
        </p>
        <p style={{ fontSize: '16px', lineHeight: '1.8', color: '#64748b', marginTop: '10px' }}>
          📧 support@kuwifr.com<br />
          📞 +91-XXXXXXXXXX
        </p>
      </section>
    </div>
  );
};

export default WarrantyPage;