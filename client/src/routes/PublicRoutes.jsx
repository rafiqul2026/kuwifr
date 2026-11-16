// client/src/routes/PublicRoutes.jsx
import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { lazyRoute, RouteFallback } from '../utils/lazyRoute';

// Homepage + 404 load immediately; every other public page is fetched on
// demand so the homepage downloads as little code as possible.
import HomePage from '../pages/public/HomePage';
import NotFoundPage from '../pages/public/NotFoundPage';
const ShopPage = lazyRoute(() => import('../pages/public/ShopPage'));
const ProductDetailPage = lazyRoute(() => import('../pages/public/ProductDetailPage'));
const AboutPage = lazyRoute(() => import('../pages/public/AboutPage'));
const ContactPage = lazyRoute(() => import('../pages/public/ContactPage'));
const BlogPage = lazyRoute(() => import('../pages/public/BlogPage'));
const FAQPage = lazyRoute(() => import('../pages/public/FAQPage'));
const TermsPage = lazyRoute(() => import('../pages/public/TermsPage'));
const PrivacyPage = lazyRoute(() => import('../pages/public/PrivacyPage'));
const DisclaimerPage = lazyRoute(() => import('../pages/public/DisclaimerPage'));
const ShippingPolicyPage = lazyRoute(() => import('../pages/public/ShippingPolicyPage'));
const RefundPolicyPage = lazyRoute(() => import('../pages/public/RefundPolicyPage'));
const HowItWorksPage = lazyRoute(() => import('../pages/public/HowItWorksPage'));
const PaymentInfoPage = lazyRoute(() => import('../pages/public/PaymentInfoPage'));
const SellerVerificationPage = lazyRoute(() => import('../pages/public/SellerVerificationPage'));
const GrievancePage = lazyRoute(() => import('../pages/public/GrievancePage'));
const CustomerSupportPage = lazyRoute(() => import('../pages/public/CustomerSupportPage'));
const WarrantyPage = lazyRoute(() => import('../pages/public/WarrantyPage'));


const PublicRoutes = () => {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Suspense fallback={<RouteFallback />}>
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
        </Suspense>
      </main>
      <Footer />
    </>
  );
};

export default PublicRoutes;