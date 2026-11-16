// client/src/pages/public/home/homeContent.js
//
// Homepage copy, kept apart from layout. Every claim here comes from the
// business's own published pages or configuration — nothing invented:
//   - company identity / CIN / GSTIN / address: seo/seoConfig.js
//   - shipping: pages/public/ShippingPolicyPage.jsx
//   - returns: pages/public/RefundPolicyPage.jsx (48-hour window)
//   - member programme: pages/public/HowItWorksPage.jsx
//   - payments: manual UPI + proof, verified by admin before activation
//     (member Packages / Repurchase checkout)
// If a policy page changes, update the matching line here.
import {
  FiShoppingBag,
  FiUsers,
  FiRepeat,
  FiBriefcase,
  FiHeadphones,
  FiFileText,
  FiShield,
  FiCheckCircle,
  FiTruck,
  FiUserPlus,
  FiPackage,
  FiCreditCard,
  FiBarChart2
} from 'react-icons/fi';

export const SERVICES = [
  {
    icon: FiShoppingBag,
    title: 'Online store',
    text: 'Health & wellness products, alkaline water devices, fashion and everyday essentials, delivered across India.',
    cta: 'Browse the shop',
    to: '/shop'
  },
  {
    icon: FiUsers,
    title: 'Member business programme',
    text: 'Join with a package that includes products, earn KBP (Kuwi Business Points) and grow with a team under our published income plan.',
    cta: 'See how it works',
    to: '/how-it-works'
  },
  {
    icon: FiRepeat,
    title: 'Repurchase store',
    text: 'Members reorder the products they use from their account and earn repurchase KBP on every verified order.',
    cta: 'Open the store',
    to: '/member/repurchase'
  },
  {
    icon: FiBriefcase,
    title: 'Franchise programme',
    text: 'Members can apply to become a KUWIFR franchise directly from their account; our team reviews each application.',
    cta: 'Apply from your account',
    to: '/member/franchise'
  },
  {
    icon: FiFileText,
    title: 'Orders & GST invoices',
    text: 'Follow every order in My Orders and download its tax invoice, issued under our registered GSTIN.',
    cta: 'Go to My Orders',
    to: '/member/orders'
  },
  {
    icon: FiHeadphones,
    title: 'Customer support',
    text: 'Raise a ticket from your account, call us, or send a message — every request reaches our support team.',
    cta: 'Get support',
    to: '/customer-support'
  }
];

export const WHY_CHOOSE = [
  {
    icon: FiShield,
    title: 'A registered company you can check',
    text: 'KUWIFR Services Pvt Ltd is incorporated in Assam. Our CIN and GSTIN are published below and printed on every invoice.'
  },
  {
    icon: FiCheckCircle,
    title: 'Every payment verified by our team',
    text: 'You pay by UPI and upload the payment proof. Our team checks it before your order or package is activated.'
  },
  {
    icon: FiTruck,
    title: 'Clear delivery and return terms',
    text: 'Free shipping on prepaid orders of ₹999+. Damaged, defective or wrong items can be reported within 48 hours of delivery.'
  },
  {
    icon: FiBarChart2,
    title: 'Everything in one account',
    text: 'Orders, invoices, packages, income, KYC and support tickets all live in your Customer Panel.'
  }
];

export const STEPS = [
  {
    icon: FiUserPlus,
    title: 'Create your account',
    text: "Register with your details and your sponsor's member ID."
  },
  {
    icon: FiPackage,
    title: 'Choose products or a package',
    text: 'Pick from the catalog, or a package with its included products.'
  },
  {
    icon: FiCreditCard,
    title: 'Pay by UPI and upload proof',
    text: 'Our team verifies the payment, then activates your order or package.'
  },
  {
    icon: FiBarChart2,
    title: 'Track it all in the Customer Panel',
    text: 'See orders and invoices, KBP, income, team and support in one place.'
  }
];

export const PANEL_FEATURES = [
  'Dashboard with your package, KBP and income',
  'My Orders with downloadable GST invoices',
  'Buy or upgrade packages, reorder products',
  'Team, ranks and income history',
  'KYC, digital ID card and profile',
  'Support tickets and notifications'
];

export const FAQS = [
  {
    q: 'How do I place an order?',
    a: 'Browse the shop and choose Buy Now or add items to your bag. Orders are placed from your KUWIFR account: sign in (or create an account), review the order, pay by UPI and upload the payment proof. Our team verifies the payment and processes the order.'
  },
  {
    q: 'How long does delivery take?',
    a: 'Metro cities usually receive orders within 3 to 6 business days of dispatch, and the rest of India within 5 to 9 business days. See the Shipping Policy for full details.'
  },
  {
    q: 'Is shipping free?',
    a: 'Shipping is free on prepaid orders of ₹999 and above. A flat ₹50 handling fee applies to domestic orders below ₹999.'
  },
  {
    q: 'What if my item arrives damaged or wrong?',
    a: 'Report it within 48 hours of delivery by emailing support@kuwifr.com or contacting support. Eligible items are replaced or refunded as described in our Refund & Returns policy.'
  },
  {
    q: 'How do I track my order?',
    a: 'Sign in and open My Orders in the Customer Panel. Each order shows its current status, and you can download its tax invoice there.'
  },
  {
    q: 'What is the KUWIFR member programme?',
    a: 'Members join with a package that includes products and earn KBP (Kuwi Business Points) on purchases. Income comes from product sales across your team under the published plan — see How It Works for the income streams and rules.'
  }
];
