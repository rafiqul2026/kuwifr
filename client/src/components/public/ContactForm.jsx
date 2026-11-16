// client/src/components/public/ContactForm.jsx
//
// The public contact form (homepage + /contact). Submits to POST
// /api/contact, which validates the message again, stores it (Admin >
// Contact Messages) and emails support. Client-side rules mirror
// server/src/controllers/contact.controller.js#validateContactInput.
import React, { useId, useRef, useState } from 'react';
import api from '../../services/api';
import styles from './ContactForm.module.css';

const EMPTY = { name: '', email: '', phone: '', subject: '', message: '', website: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}$/;
const MAX_MESSAGE = 2000;

export const validateContact = (v) => {
  const e = {};
  const name = v.name.trim();
  const email = v.email.trim();
  const phone = v.phone.trim();
  const subject = v.subject.trim();
  const message = v.message.trim();
  if (name.length < 2) e.name = 'Please enter your name.';
  else if (name.length > 80) e.name = 'Name must be 80 characters or fewer.';
  if (!email) e.email = 'Please enter your email address.';
  else if (!EMAIL_RE.test(email) || email.length > 120) e.email = 'Please enter a valid email address.';
  if (phone && !PHONE_RE.test(phone)) e.phone = 'Please enter a valid 10-digit mobile number.';
  if (subject.length < 3) e.subject = 'Please add a short subject.';
  else if (subject.length > 120) e.subject = 'Subject must be 120 characters or fewer.';
  if (message.length < 10) e.message = 'Please write a little more (at least 10 characters).';
  else if (message.length > MAX_MESSAGE) e.message = `Message must be ${MAX_MESSAGE} characters or fewer.`;
  return e;
};

const FIELD_ORDER = ['name', 'email', 'phone', 'subject', 'message'];

const ContactForm = ({ compact = false }) => {
  const uid = useId();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | success | error
  const [serverMessage, setServerMessage] = useState('');
  const refs = useRef({});

  const id = (f) => `${uid}-${f}`;

  const onChange = (field) => (e) => {
    const next = { ...values, [field]: e.target.value };
    setValues(next);
    if (touched[field]) setErrors(validateContact(next));
    if (status === 'error') setStatus('idle');
  };

  const onBlur = (field) => () => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors(validateContact(values));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (status === 'sending') return;
    const found = validateContact(values);
    setErrors(found);
    setTouched({ name: true, email: true, phone: true, subject: true, message: true });
    const first = FIELD_ORDER.find((f) => found[f]);
    if (first) {
      refs.current[first]?.focus();
      return;
    }

    setStatus('sending');
    setServerMessage('');
    try {
      const res = await api.post('/api/contact', {
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        subject: values.subject.trim(),
        message: values.message.trim(),
        website: values.website
      });
      setStatus('success');
      setServerMessage(res.data?.message || 'Thank you! Your message has been received.');
      setValues(EMPTY);
      setTouched({});
      setErrors({});
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) {
        setErrors(data.errors);
        const firstBad = FIELD_ORDER.find((f) => data.errors[f]);
        if (firstBad) refs.current[firstBad]?.focus();
      }
      setStatus('error');
      setServerMessage(
        data?.message ||
          (err.request && !err.response
            ? 'We could not reach the server. Please check your connection and try again.'
            : 'Something went wrong while sending your message. Please try again.')
      );
    }
  };

  if (status === 'success') {
    return (
      <div className={styles.success} role="status" aria-live="polite">
        <span className={styles.successIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
        <h3>Message sent</h3>
        <p>{serverMessage}</p>
        <button type="button" className={styles.linkBtn} onClick={() => setStatus('idle')}>
          Send another message
        </button>
      </div>
    );
  }

  const field = (name, label, { type = 'text', required = true, placeholder, autoComplete, inputMode, multiline = false, hint } = {}) => {
    const err = touched[name] && errors[name];
    const describedBy = [err ? `${id(name)}-err` : null, hint ? `${id(name)}-hint` : null].filter(Boolean).join(' ') || undefined;
    const common = {
      id: id(name),
      name,
      value: values[name],
      onChange: onChange(name),
      onBlur: onBlur(name),
      placeholder,
      autoComplete,
      inputMode,
      'aria-invalid': err ? 'true' : 'false',
      'aria-describedby': describedBy,
      'aria-required': required ? 'true' : undefined,
      ref: (el) => { refs.current[name] = el; },
      className: `${styles.input} ${err ? styles.inputError : ''}`
    };
    return (
      <div className={`${styles.field} ${multiline ? styles.fieldFull : ''}`}>
        <label htmlFor={id(name)} className={styles.label}>
          {label} {required ? <span aria-hidden="true" className={styles.req}>*</span> : <span className={styles.optional}>(optional)</span>}
        </label>
        {multiline ? (
          <textarea {...common} rows={compact ? 4 : 5} maxLength={MAX_MESSAGE + 200} />
        ) : (
          <input {...common} type={type} />
        )}
        {hint && !err && <span id={`${id(name)}-hint`} className={styles.hint}>{hint}</span>}
        {err && <span id={`${id(name)}-err`} className={styles.error}>{err}</span>}
      </div>
    );
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate aria-describedby={`${uid}-legend`}>
      <p id={`${uid}-legend`} className={styles.legend}>
        Fields marked <span aria-hidden="true" className={styles.req}>*</span><span className={styles.srOnly}>with an asterisk</span> are required.
      </p>
      <div className={styles.grid}>
        {field('name', 'Full name', { placeholder: 'Your name', autoComplete: 'name' })}
        {field('email', 'Email', { type: 'email', placeholder: 'you@example.com', autoComplete: 'email', inputMode: 'email' })}
        {field('phone', 'Mobile number', { type: 'tel', required: false, placeholder: '10-digit mobile', autoComplete: 'tel', inputMode: 'tel' })}
        {field('subject', 'Subject', { placeholder: 'Order, product, account…' })}
        {field('message', 'Message', {
          multiline: true,
          placeholder: 'How can we help? Include your order ID or member ID if you have one.',
          hint: `${values.message.trim().length}/${MAX_MESSAGE} characters`
        })}
      </div>

      {/* Honeypot: hidden from people and screen readers; bots fill it. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor={id('website')}>Website</label>
        <input id={id('website')} name="website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={onChange('website')} />
      </div>

      {status === 'error' && (
        <div className={styles.formError} role="alert">{serverMessage}</div>
      )}

      <button type="submit" className={styles.submit} disabled={status === 'sending'} aria-busy={status === 'sending'}>
        {status === 'sending' ? (
          <>
            <span className={styles.spinner} aria-hidden="true" /> Sending…
          </>
        ) : (
          'Send message'
        )}
      </button>
    </form>
  );
};

export default ContactForm;
