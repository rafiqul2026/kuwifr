// client/src/routes/PublicRoutes.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';

// Public Pages
import HomePage from '../pages/public/HomePage';
import AboutPage from '../pages/public/AboutPage';
import ContactPage from '../pages/public/ContactPage';
import BlogPage from '../pages/public/BlogPage';
import FAQPage from '../pages/public/FAQPage';
import TermsPage from '../pages/public/TermsPage';
import PrivacyPage from '../pages/public/PrivacyPage';
import DisclaimerPage from '../pages/public/DisclaimerPage';
import ShippingPolicyPage from '../pages/public/ShippingPolicyPage';
import RefundPolicyPage from '../pages/public/RefundPolicyPage';


const PublicRoutes = () => {
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/disclaimer" element={<DisclaimerPage />} />
          <Route path="/shipping-policy" element={<ShippingPolicyPage />} />
          <Route path="/refund-policy" element={<RefundPolicyPage />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
};

export default PublicRoutes;