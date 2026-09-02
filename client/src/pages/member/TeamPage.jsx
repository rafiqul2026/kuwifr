// client/src/pages/member/TeamPage.jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './TeamPage.module.css';

const TeamPage = () => {
  const { showNotification } = useNotification();

  const [teamMembers, setTeamMembers] = useState([]);
  const [stats, setStats] = useState({
    directReferrals: 0,
    activeMembers: 0,
    totalTeam: 0,
    levels: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedMember, setSelectedMember] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    fetchTeamData();
  }, []);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const [teamRes, statsRes] = await Promise.all([
        api.get('/api/users/team'),
        api.get('/api/users/team-stats')
      ]);

      if (teamRes.data?.success) {
        setTeamMembers(teamRes.data.data.team || []);
      }
      if (statsRes.data?.success) {
        setStats(statsRes.data.data);
      }
    } catch {
      showNotification('Failed to load team data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewMember = async (memberId) => {
    try {
      setModalLoading(true);
      const res = await api.get(`/api/users/${memberId}`);
      if (res.data?.success) {
        setSelectedMember(res.data.data.user);
      }
    } catch {
      showNotification('Failed to fetch member details', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    showNotification('Member ID copied to clipboard!', 'info');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const filteredMembers = teamMembers.filter((m) => {
    const matchesSearch =
      m.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.memberId?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' || m.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className={styles.pageContainer}>
      {/* Top Header Section */}
      <div className={styles.headerRow}>
        <div className={styles.titleGroup}>
          <div className={styles.titleBadge}>NETWORK GENEALOGY</div>
          <h1 className={styles.pageTitle}>My Team Overview</h1>
          <p className={styles.pageSubtitle}>
            Monitor your direct referrals, team growth, and active performance levels.
          </p>
        </div>

        <div className={styles.totalTeamCard}>
          <div className={styles.totalTeamLabel}>Total Network Size</div>
          <div className={styles.totalTeamCount}>
            {stats.totalTeam || teamMembers.length}
            <span className={styles.unitText}>Members</span>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className={styles.metricsGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiBlue}`}>
          <div className={styles.kpiIconWrapper}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiTitle}>Direct Referrals</span>
            <div className={styles.kpiValueWrapper}>
              <h3 className={styles.kpiNumber}>{stats.directReferrals || teamMembers.length}</h3>
              <span className={styles.kpiSub}>Frontline Tier</span>
            </div>
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiGreen}`}>
          <div className={styles.kpiIconWrapper}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiTitle}>Active Accounts</span>
            <div className={styles.kpiValueWrapper}>
              <h3 className={styles.kpiNumber}>{stats.activeMembers || 0}</h3>
              <span className={styles.kpiSubGreen}>Activated</span>
            </div>
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiPurple}`}>
          <div className={styles.kpiIconWrapper}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiTitle}>Total Downline</span>
            <div className={styles.kpiValueWrapper}>
              <h3 className={styles.kpiNumber}>{stats.totalTeam || teamMembers.length}</h3>
              <span className={styles.kpiSub}>10 Generations</span>
            </div>
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiAmber}`}>
          <div className={styles.kpiIconWrapper}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiTitle}>Network Depth</span>
            <div className={styles.kpiValueWrapper}>
              <h3 className={styles.kpiNumber}>{stats.levels || (teamMembers.length > 0 ? 1 : 0)}</h3>
              <span className={styles.kpiSub}>Active Levels</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Glass Table Container */}
      <div className={styles.mainCard}>
        {/* Controls Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Search member name or Member ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.filterGroup}>
            <div className={styles.selectWrapper}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={styles.statusSelect}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Members</option>
                <option value="INACTIVE">Inactive Members</option>
              </select>
            </div>

            <button
              type="button"
              className={styles.refreshBtn}
              onClick={fetchTeamData}
              title="Refresh Team List"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={loading ? styles.rotating : ''}>
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Content Table / State */}
        {loading ? (
          <div className={styles.centerBox}>
            <div className={styles.glowSpinner}></div>
            <p className={styles.loadingText}>Syncing network members...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className={styles.centerBox}>
            <div className={styles.emptyIconWrap}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
            </div>
            <h4 className={styles.emptyTitle}>No Members Found</h4>
            <p className={styles.emptyDesc}>Try adjusting your search filter or add new direct referrals.</p>
          </div>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.customTable}>
              <thead>
                <tr>
                  <th className={styles.thSl}>SL</th>
                  <th className={styles.thMember}>MEMBER</th>
                  <th className={styles.thStatus}>STATUS</th>
                  <th className={styles.thAction}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member, index) => {
                  const initial = (member.fullName || 'M').charAt(0).toUpperCase();
                  const isActive = member.status === 'ACTIVE';

                  return (
                    <tr key={member._id} className={styles.tableRow}>
                      <td className={styles.tdSl}>
                        <span className={styles.slTag}>
                          #{String(index + 1).padStart(2, '0')}
                        </span>
                      </td>

                      <td className={styles.tdMember}>
                        <div className={styles.memberIdentityBlock}>
                          <div className={`${styles.avatarCircle} ${isActive ? styles.avatarActive : styles.avatarInactive}`}>
                            {initial}
                          </div>
                          <div className={styles.nameBlock}>
                            <span className={styles.memberNameText}>{member.fullName}</span>
                          </div>
                        </div>
                      </td>

                      <td className={styles.tdStatus}>
                        <span className={isActive ? styles.badgeActive : styles.badgeInactive}>
                          <span className={styles.statusDot}></span>
                          {member.status}
                        </span>
                      </td>

                      <td className={styles.tdAction}>
                        <button
                          type="button"
                          className={styles.actionViewBtn}
                          onClick={() => handleViewMember(member._id)}
                        >
                          <span>View</span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= MODERN MODAL POPUP ================= */}
      {selectedMember && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedMember(null)}>
          <div className={styles.modalWindow} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header Banner */}
            <div className={styles.modalTopBanner}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalCategoryTag}>MEMBER PROFILE</span>
                <h3>Downline Details</h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseIconBtn}
                onClick={() => setSelectedMember(null)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className={styles.modalInnerBody}>
              <div className={styles.profileHero}>
                <div className={`${styles.largeAvatar} ${selectedMember.status === 'ACTIVE' ? styles.avatarActive : styles.avatarInactive}`}>
                  {selectedMember.fullName?.charAt(0) || 'M'}
                </div>
                <h3 className={styles.heroName}>{selectedMember.fullName}</h3>
                <span className={selectedMember.status === 'ACTIVE' ? styles.badgeActiveHero : styles.badgeInactiveHero}>
                  ● {selectedMember.status}
                </span>
              </div>

              {/* Core 3 Details Section */}
              <div className={styles.coreCredentialsCard}>
                <div className={styles.credentialRow}>
                  <div className={styles.credentialLabelBlock}>
                    <span className={styles.credIcon}>👤</span>
                    <span className={styles.credLabel}>Full Name</span>
                  </div>
                  <strong className={styles.credValuePrimary}>{selectedMember.fullName}</strong>
                </div>

                <div className={styles.credentialRow}>
                  <div className={styles.credentialLabelBlock}>
                    <span className={styles.credIcon}>✉️</span>
                    <span className={styles.credLabel}>Email Address</span>
                  </div>
                  <span className={styles.credValueEmail}>{selectedMember.email}</span>
                </div>

                <div className={styles.credentialRow}>
                  <div className={styles.credentialLabelBlock}>
                    <span className={styles.credIcon}>🆔</span>
                    <span className={styles.credLabel}>Member User ID</span>
                  </div>
                  <div
                    className={styles.memberIdChip}
                    onClick={() => copyToClipboard(selectedMember.memberId)}
                    title="Click to copy Member ID"
                  >
                    <code>{selectedMember.memberId || 'KFR------'}</code>
                    <span className={styles.copyNotice}>{copiedId ? 'Copied!' : 'Copy'}</span>
                  </div>
                </div>
              </div>

              {/* Secondary Details Grid */}
              <div className={styles.secondaryGrid}>
                <div className={styles.secondaryTile}>
                  <small>Phone Number</small>
                  <strong>{selectedMember.phoneNumber || 'N/A'}</strong>
                </div>

                <div className={styles.secondaryTile}>
                  <small>Binary Leg</small>
                  <strong className={styles.sideHighlight}>
                    {selectedMember.binarySide ? selectedMember.binarySide.toUpperCase() : 'LEFT'}
                  </strong>
                </div>

                <div className={styles.secondaryTile}>
                  <small>Active Package</small>
                  <strong>{selectedMember.activePackageId?.name || 'Starter Package'}</strong>
                </div>

                <div className={styles.secondaryTile}>
                  <small>Joined Date</small>
                  <strong>
                    {new Date(selectedMember.createdAt || selectedMember.joinedDate).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </strong>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.modalDoneBtn}
                  onClick={() => setSelectedMember(null)}
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamPage;