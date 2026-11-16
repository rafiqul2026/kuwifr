// client/src/components/public/NewsletterForm.jsx
// Email sign-up for offers (POST /api/newsletter/subscribe). Lives in the
// public footer; previously only on the old homepage.
import React, { useId, useState } from 'react';
import api from '../../services/api';
import styles from './NewsletterForm.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const NewsletterForm = () => {
  const uid = useId();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [message, setMessage] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    if (status === 'loading') return;
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      const res = await api.post('/api/newsletter/subscribe', { email: value });
      setStatus('success');
      setMessage(res.data?.message || 'Subscribed. Thank you!');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.message || 'Could not subscribe right now. Please try again.');
    }
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <label htmlFor={`${uid}-email`} className={styles.label}>Get offers and new arrivals by email</label>
      <div className={styles.row}>
        <input
          id={`${uid}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (status === 'error') setStatus('idle'); }}
          aria-invalid={status === 'error'}
          aria-describedby={message ? `${uid}-msg` : undefined}
          className={styles.input}
        />
        <button type="submit" className={styles.button} disabled={status === 'loading'}>
          {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
        </button>
      </div>
      {message && (
        <p id={`${uid}-msg`} role="status" className={status === 'error' ? styles.error : styles.success}>
          {message}
        </p>
      )}
    </form>
  );
};

export default NewsletterForm;
