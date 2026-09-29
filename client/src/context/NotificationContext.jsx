import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { ToastContainer, toast, Slide } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/toast.css';

// Create the context
const NotificationContext = createContext(null);

// Custom hook to use notification
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

// Solid round icon per type (white glyph on the type colour — see toast.css).
const ICON_PATHS = {
  success: <path d="M6.5 12.5l3.5 3.5 7.5-8" />,
  error: <path d="M8 8l8 8M16 8l-8 8" />,
  warning: (
    <>
      <path d="M12 7v6" />
      <path d="M12 16.8v.2" />
    </>
  ),
  info: (
    <>
      <path d="M12 11v6" />
      <path d="M12 7.2v.2" />
    </>
  )
};

// How long each kind stays up — errors get longer so they can be read.
const AUTO_CLOSE = { success: 4000, info: 4000, warning: 5500, error: 6500 };

const ToastContent = ({ type, title, message }) => (
  <div className="kfr-toast__content">
    <span className={`kfr-toast__icon kfr-toast__icon--${type}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {ICON_PATHS[type]}
      </svg>
    </span>
    <div className="kfr-toast__text">
      {title && <p className="kfr-toast__title">{title}</p>}
      <p className={title ? 'kfr-toast__message' : 'kfr-toast__title kfr-toast__title--solo'}>{message}</p>
    </div>
  </div>
);

const CloseButton = ({ closeToast }) => (
  <button type="button" className="kfr-toast__close" onClick={closeToast} aria-label="Dismiss notification">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  </button>
);

// Notification Provider component - MUST be exported as named export
export const NotificationProvider = ({ children }) => {
  /**
   * showNotification(message, type = 'info', options = {})
   *   type: 'success' | 'error' | 'warning' | 'info'
   *   options.title: optional bold heading shown above the message
   *   any other option is passed through to react-toastify.
   *
   * Stable identity (useCallback): many pages list showNotification in their
   * useCallback/useEffect deps. It used to be re-created on every render and
   * also pushed each message into a never-read state array, so every toast
   * re-rendered the whole app and could make those pages re-fetch.
   */
  const showNotification = useCallback((message, type = 'info', options = {}) => {
    const kind = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
    const { title, ...rest } = options || {};
    const text = typeof message === 'string' ? message : String(message ?? '');

    toast(<ToastContent type={kind} title={title} message={text} />, {
      type: kind,
      icon: false,
      autoClose: AUTO_CLOSE[kind],
      // The same message already on screen isn't stacked again.
      toastId: `${kind}:${title || ''}:${text}`,
      className: `kfr-toast kfr-toast--${kind}`,
      ...rest
    });
  }, []);

  // Kept for API compatibility (nothing reads a notification history).
  const clearNotifications = useCallback(() => toast.dismiss(), []);

  const value = useMemo(
    () => ({ notifications: [], showNotification, clearNotifications }),
    [showNotification, clearNotifications]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <ToastContainer
        position="top-right"
        transition={Slide}
        theme="light"
        newestOnTop
        limit={4}
        closeOnClick={false}
        pauseOnHover
        pauseOnFocusLoss
        draggable
        draggablePercent={40}
        closeButton={CloseButton}
      />
    </NotificationContext.Provider>
  );
};

// Default export for the context
export default NotificationContext;
