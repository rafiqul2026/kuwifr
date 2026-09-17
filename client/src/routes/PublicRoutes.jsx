// client/src/routes/PublicRoutes.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';

// Public Pages
import HomePage from '../pages/public/HomePage';
import ShopPage from '../pages/public/ShopPage';
import ProductDetailPage from '../pages/public/ProductDetailPage';
import AboutPage from '../pages/public/AboutPage';
import ContactPage from '../pages/public/ContactPage';
import BlogPage from '../pages/public/BlogPage';
import FAQPage from '../pages/public/FAQPage';
import TermsPage from '../pages/public/TermsPage';
import PrivacyPage from '../pages/public/PrivacyPage';
import DisclaimerPage from '../pages/public/DisclaimerPage';
import ShippingPolicyPage from '../pages/public/ShippingPolicyPage';
import RefundPolicyPage from '../pages/public/RefundPolicyPage';
import HowItWorksPage from '../pages/public/HowItWorksPage';
import PaymentInfoPage from '../pages/public/PaymentInfoPage';
import SellerVerificationPage from '../pages/public/SellerVerificationPage';
import GrievancePage from '../pages/public/GrievancePage';
import CustomerSupportPage from '../pages/public/CustomerSupportPage';
import WarrantyPage from '../pages/public/WarrantyPage';
import NotFoundPage from '../pages/public/NotFoundPage';


const PublicRoutes = () => {
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          {/* Previously mounted directly in App.jsx, bypassing this
              Header/Footer wrapper entirely — moved here so /shop is part
              of the site's normal layout and internal-link structure. */}
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/disclaimer" element={<DisclaimerPage />} />
          <Route path="/shipping-policy" element={<ShippingPolicyPage />} />
          <Route path="/refund-policy" element={<RefundPolicyPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/payment-info" element={<PaymentInfoPage />} />
          <Route path="/seller-verification" element={<SellerVerificationPage />} />
          <Route path="/grievance" element={<GrievancePage />} />
          <Route path="/customer-support" element={<CustomerSupportPage />} />
          <Route path="/warranty" element={<WarrantyPage />} />
          {/* Previously no catch-all existed here, so an unmatched public
              URL rendered an empty <main> with HTTP 200 and no noindex
              signal (a "soft 404" — see NotFoundPage.jsx's comment). */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
};

export default PublicRoutes;