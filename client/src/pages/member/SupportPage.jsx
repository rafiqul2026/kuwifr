// client/src/pages/member/SupportPage.jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import styles from './SupportPage.module.css';

const CATEGORIES = [
  { value: 'WITHDRAWAL_PAYOUT', label: 'Payout / Bank Withdrawal' },
  { value: 'REPURCHASE_KBP', label: 'Repurchase / KBP & Cashback' },
  { value: 'KYC_VERIFICATION', label: 'KYC Document Approval' },
  { value: 'BINARY_TREE', label: 'Binary Placement / Downline' },
  { value: 'PACKAGE_ACTIVATION', label: 'Package Activation & Products' },
  { value: 'GENERAL', label: 'General Technical Query' }
];

const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' }
];

const SupportPage = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('tickets'); // 'tickets' | 'new' | 'contact'
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  // New Ticket Form State
  const [formData, setFormData] = useState({
    category: 'WITHDRAWAL_PAYOUT',
    priority: 'MEDIUM',
    subject: '',
    message: ''
  });

  useEffect(() => {
    fetchMyTickets();
  }, []);

  const fetchMyTickets = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/support/my-tickets');
      if (res.data?.success) {
        setTickets(res.data.data.tickets || []);
        setStats(res.data.data.stats || { total: 0, open: 0, inProgress: 0, resolved: 0 });
      }
    } catch {
      showNotification('Failed to load tickets', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.message.trim()) {
      showNotification('Please fill in both the subject and problem details.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/api/support/create-ticket', formData);
      if (res.data?.success) {
        showNotification(res.data.message, 'success');
        setFormData({
          category: 'WITHDRAWAL_PAYOUT',
          priority: 'MEDIUM',
          subject: '',
          message: ''
        });
        setActiveTab('tickets');
        fetchMyTickets();
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to submit ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async (ticketId) => {
    if (!replyText.trim()) return;

    setReplying(true);
    try {
      const res = await api.post(`/api/support/tickets/${ticketId}/reply`, { message: replyText });
      if (res.data?.success) {
        showNotification('Reply posted successfully', 'success');
        setReplyText('');
        setSelectedTicket(res.data.data.ticket);
        fetchMyTickets();
      }
    } catch {
      showNotification('Failed to post reply', 'error');
    } finally {
      setReplying(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return <span className={`${styles.badge} ${styles.badgeOpen}`}>● Open</span>;
      case 'IN_PROGRESS':
        return <span className={`${styles.badge} ${styles.badgeProgress}`}>⏳ In Progress</span>;
      case 'RESOLVED':
        return <span className={`${styles.badge} ${styles.badgeResolved}`}>✓ Resolved</span>;
      case 'CLOSED':
        return <span className={`${styles.badge} ${styles.badgeClosed}`}>Closed</span>;
      default:
        return <span className={styles.badge}>{status}</span>;
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'URGENT':
        return <span className={`${styles.priorityChip} ${styles.pUrgent}`}>Urgent</span>;
      case 'HIGH':
        return <span className={`${styles.priorityChip} ${styles.pHigh}`}>High</span>;
      case 'MEDIUM':
        return <span className={`${styles.priorityChip} ${styles.pMed}`}>Medium</span>;
      default:
        return <span className={`${styles.priorityChip} ${styles.pLow}`}>Low</span>;
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.spinner}></div>
        <p>Loading Customer Support Hub...</p>
      </div>
    );
  }

  return (
    <div className={styles.supportContainer}>
      {/* Header */}
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.headerTag}>🎧 24/7 Dedicated Helpdesk</span>
          <h1 className={styles.pageTitle}>Support & Ticket Center</h1>
          <p className={styles.pageSubtitle}>
            Raise tickets for technical, payout, or tree queries and track resolutions from company admins.
          </p>
        </div>
      </header>

      {/* Stats Summary */}
      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#eff6ff', color: '#2563eb' }}>🎫</div>
          <div className={styles.statInfo}>
            <small>Total Tickets</small>
            <h3>{stats.total}</h3>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#fffbeb', color: '#d97706' }}>⏳</div>
          <div className={styles.statInfo}>
            <small>Pending Resolution</small>
            <h3>{stats.open + stats.inProgress}</h3>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#f0fdf4', color: '#16a34a' }}>✅</div>
          <div className={styles.statInfo}>
            <small>Resolved Tickets</small>
            <h3>{stats.resolved}</h3>
          </div>
        </div>
      </section>

      {/* Navigation Switcher */}
      <nav className={styles.tabsNav}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'tickets' ? styles.tabActive : ''}`}
          onClick={() => { setActiveTab('tickets'); setSelectedTicket(null); }}
        >
          <span>📋 My Tickets ({tickets.length})</span>
        </button>

        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'new' ? styles.tabActive : ''}`}
          onClick={() => { setActiveTab('new'); setSelectedTicket(null); }}
        >
          <span>➕ Raise New Ticket</span>
        </button>

        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'contact' ? styles.tabActive : ''}`}
          onClick={() => { setActiveTab('contact'); setSelectedTicket(null); }}
        >
          <span>📞 Contact Helpdesk</span>
        </button>
      </nav>

      {/* TAB 1: MY TICKETS LIST */}
      {activeTab === 'tickets' && !selectedTicket && (
        <section className={styles.tabSection}>
          {tickets.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🎫</span>
              <h3>No Support Tickets Raised Yet</h3>
              <p>Experiencing any issue with withdrawals, KBP, or account? Raise a ticket and our support team will assist you.</p>
              <button
                type="button"
                className={styles.raiseBtn}
                onClick={() => setActiveTab('new')}
              >
                + Raise Your First Ticket
              </button>
            </div>
          ) : (
            <div className={styles.ticketsTableCard}>
              <table className={styles.ticketTable}>
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Category</th>
                    <th>Subject</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Created Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t._id}>
                      <td><span className={styles.ticketCode}>{t.ticketId}</span></td>
                      <td>
                        <span className={styles.categoryBadge}>
                          {CATEGORIES.find(c => c.value === t.category)?.label || t.category}
                        </span>
                      </td>
                      <td className={styles.subjectCell}>
                        <strong>{t.subject}</strong>
                      </td>
                      <td>{getPriorityBadge(t.priority)}</td>
                      <td>{getStatusBadge(t.status)}</td>
                      <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.viewDetailsBtn}
                          onClick={() => setSelectedTicket(t)}
                        >
                          View & Reply →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TICKET DETAILS & REPLY TIMELINE VIEW */}
      {selectedTicket && (
        <section className={styles.ticketDetailCard}>
          <div className={styles.detailHeader}>
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => setSelectedTicket(null)}
            >
              ← Back to All Tickets
            </button>
            <div className={styles.detailMeta}>
              <span className={styles.ticketCode}>{selectedTicket.ticketId}</span>
              {getStatusBadge(selectedTicket.status)}
              {getPriorityBadge(selectedTicket.priority)}
            </div>
          </div>

          <div className={styles.detailBody}>
            <h2 className={styles.detailSubject}>{selectedTicket.subject}</h2>
            <div className={styles.initialMessageBubble}>
              <div className={styles.bubbleHead}>
                <strong>You ({user?.fullName})</strong>
                <small>{new Date(selectedTicket.createdAt).toLocaleString()}</small>
              </div>
              <p>{selectedTicket.message}</p>
            </div>

            {/* Replies Stream */}
            <div className={styles.repliesStream}>
              <h4>💬 Conversation History</h4>
              {selectedTicket.replies?.length === 0 ? (
                <p className={styles.noRepliesText}>Our support team is reviewing your ticket. You will receive an update shortly.</p>
              ) : (
                selectedTicket.replies?.map((rep, idx) => {
                  const isAdmin = rep.senderRole === 'ADMIN' || rep.senderRole === 'SUPPORT';
                  return (
                    <div
                      key={idx}
                      className={`${styles.replyBubble} ${isAdmin ? styles.adminBubble : styles.userBubble}`}
                    >
                      <div className={styles.bubbleHead}>
                        <strong>{isAdmin ? '🛡️ Admin Support' : `You (${user?.fullName})`}</strong>
                        <small>{new Date(rep.createdAt).toLocaleString()}</small>
                      </div>
                      <p>{rep.message}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply Input Box */}
            {selectedTicket.status !== 'CLOSED' && (
              <div className={styles.replyFormBox}>
                <textarea
                  rows="3"
                  placeholder="Type your message or follow-up response here..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.sendReplyBtn}
                  onClick={() => handleSendReply(selectedTicket._id)}
                  disabled={replying || !replyText.trim()}
                >
                  {replying ? 'Sending Reply...' : 'Post Reply'}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB 2: RAISE NEW TICKET FORM */}
      {activeTab === 'new' && (
        <section className={styles.formCard}>
          <div className={styles.formHeader}>
            <h3>Submit a Support Ticket</h3>
            <p>Please provide exact details so our admin team can assist and resolve your problem quickly.</p>
          </div>

          <form onSubmit={handleSubmitTicket} className={styles.ticketForm}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Issue Category *</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Priority Level *</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                >
                  {PRIORITIES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Subject / Brief Summary *</label>
              <input
                type="text"
                name="subject"
                placeholder="e.g. Withdrawal request not credited to bank account"
                value={formData.subject}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Detailed Description of the Issue *</label>
              <textarea
                name="message"
                rows="6"
                placeholder="Please describe what happened in detail (include transaction IDs, member IDs, or dates if applicable)..."
                value={formData.message}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={submitting}
              >
                {submitting ? 'Submitting Ticket...' : 'Submit Support Ticket →'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* TAB 3: CONTACT HELPDESK INFO */}
      {activeTab === 'contact' && (
        <section className={styles.contactGrid}>
          <div className={styles.contactCard}>
            <div className={styles.contactIcon}>💬</div>
            <h4>WhatsApp Support</h4>
            <p>Fast assistance for urgent activations & queries</p>
            <strong>+91 98765 43210</strong>
          </div>

          <div className={styles.contactCard}>
            <div className={styles.contactIcon}>✉️</div>
            <h4>Email Helpdesk</h4>
            <p>Official corporate assistance & payout inquiries</p>
            <strong>support@kuwifr.com</strong>
          </div>

          <div className={styles.contactCard}>
            <div className={styles.contactIcon}>⏰</div>
            <h4>Operating Hours</h4>
            <p>Support desk active for members nationwide</p>
            <strong>Mon - Sat: 10:00 AM - 7:00 PM</strong>
          </div>
        </section>
      )}
    </div>
  );
};

export default SupportPage;