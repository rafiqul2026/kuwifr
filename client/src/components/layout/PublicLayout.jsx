import React from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";

import styles from "./PublicLayout.module.css";

/**
 * Public Layout - Wrapper for all public pages
 * Includes header, footer, and notification bar
 */
const PublicLayout = () => {
  return (
    <div className={styles.publicLayout}>
      <Header />
      <main className={styles.mainContent}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default PublicLayout;
