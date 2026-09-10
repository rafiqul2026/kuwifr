// client/src/pages/member/TeamPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './TeamPage.module.css';

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const TeamPage = () => {
  const { showNotification } = useNotification();

  // Generation/level-wise genealogy (First Level Member, Second Level Member, ...)
  const [levels, setLevels] = useState([]);
  const [genTotals, setGenTotals] = useState({ totalTeam: 0, directCount: 0 });

  const [stats, setStats] = useState({
    directReferrals: 0,
    activeMembers: 0,
    totalTeam: 0,
    leftCount: 0,
    rightCount: 0
  });
  const [sponsorInfo, setSponsorInfo] = useState({
    fullName: 'Direct Company Root',
    memberId: 'ROOT'
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Which generation boxes are expanded. Level 1 (First Level Member) starts
  // open; everything else starts open only if it already has members in it.
  const [expandedLevels, setExpandedLevels] = useState({ 1: true });

  // "View" basic-details popup for a single member (no extra API call — every
  // field it needs already came down with the generation list).
  const [viewMember, setViewMember] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  const fetchTeamData = useCallback(async () => {
    try {
      setLoading(true);
      const [genRes, statsRes, profileRes, overviewRes] = await Promise.all([
        api.get('/api/users/team/by-generation'),
        api.get('/api/users/team-stats'),
        api.get('/api/users/profile'),
        api.get('/api/team/overview')
      ]);

      if (genRes.data?.success && genRes.data?.data) {
        const fetchedLevels = genRes.data.data.levels || [];
        setLevels(fetchedLevels);
        setGenTotals({
          totalTeam: genRes.data.data.totalTeam || 0,
          directCount: genRes.data.data.directCount || 0
        });
        // Auto-open every generation that already has people in it, on first load.
        setExpandedLevels((prev) => {
          const next = { ...prev };
          fetchedLevels.forEach((lvl) => {
            if (lvl.count > 0 && next[lvl.level] === undefined) {
              next[lvl.level] = true;
            }
          });
          return next;
        });
      }

      let leftC = 0;
      let rightC = 0;
      if (overviewRes.data?.success && overviewRes.data?.data) {
        leftC = overviewRes.data.data.leftCount || 0;
        rightC = overviewRes.data.data.rightCount || 0;
      }

      if (statsRes.data?.success && statsRes.data?.data) {
        setStats({
          ...statsRes.data.data,
          leftCount: leftC,
          rightCount: rightC
        });
      }

      if (profileRes.data?.success && profileRes.data?.data?.user?.sponsorId) {
        const sp = profileRes.data.data.user.sponsorId;
        setSponsorInfo({
          fullName: sp.fullName || 'Direct Company Root',
          memberId: sp.memberId || sp.referralCode || 'ROOT'
        });
      }
    } catch {
      showNotification('Failed to load team data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  const toggleLevel = (level) => {
    setExpandedLevels((prev) => ({ ...prev, [level]: !prev[level] }));
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    showNotification('Member ID copied to clipboard!', 'info');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const isFiltering = searchTerm.trim() !== '' || statusFilter !== 'ALL';

  // Apply search + status filter within every generation box independently.
  const filteredLevels = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return levels.map((lvl) => {
      const members = (lvl.members || []).filter((m) => {
        const matchesSearch =
          !term ||
          m.fullName?.toLowerCase().includes(term) ||
          m.email?.toLowerCase().includes(term) ||
          m.memberId?.toLowerCase().includes(term);
        const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
        return matchesSearch && matchesStatus;
      });
      return { ...lvl, members, originalCount: lvl.count };
    });
  }, [levels, searchTerm, statusFilter]);

  const totalVisibleMembers = filteredLevels.reduce((sum, lvl) => sum + lvl.members.length, 0);

  return (
    <div className={styles.pageContainer}>
      {/* Top Header Section with Sponsor & Team Size */}
      <div className={styles.headerRow}>
        <div className={styles.titleGroup}>
          <div className={styles.titleBadge}>NETWORK GENEALOGY</div>
          <h1 className={styles.pageTitle}>My Team Overview</h1>
          <p className={styles.pageSubtitle}>
            Monitor your direct referrals, team growth, and active performance levels.
          </p>
        </div>

        <div className={styles.headerCardsGroup}>
          {/* Senior / Direct Sponsor Card */}
          <div className={styles.sponsorCard}>
            <div className={styles.sponsorTopLabel}>
              <span>🤝 MY DIRECT SPONSOR / SENIOR</span>
            </div>
            <div className={styles.sponsorInfoRow}>
              <div className={styles.sponsorAvatar}>
                <span className={styles.sponsorIdPill}>ID: {sponsorInfo.memberId}</span>
              </div>
            </div>
          </div>

          {/* Total Network Size Card */}
          <div className={styles.totalTeamCard}>
            <div className={styles.totalTeamLabel}>Total Network Size</div>
            <div className={styles.totalTeamCount}>
              {/* Defense in depth: never show a network size smaller than the
                  Direct Referrals card just to its left — see the backend
                  comment on getTeamStats' totalTeam for why these two could
                  otherwise disagree. */}
              {Math.max(stats.totalTeam || 0, genTotals.totalTeam || 0, stats.directReferrals || 0)}
              <span className={styles.unitText}>Members</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className={styles.metricsGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className={`${styles.kpiCard} ${styles.kpiBlue}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiTitle}>Direct Referrals</span>
            <div className={styles.kpiValueWrapper}>
              <h3 className={styles.kpiNumber}>{stats.directReferrals || genTotals.directCount}</h3>
              <span className={styles.kpiSub}>Frontline Tier</span>
            </div>
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiGreen}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiTitle}>Active Accounts</span>
            <div className={styles.kpiValueWrapper}>
              <h3 className={styles.kpiNumber}>{stats.activeMembers || 0}</h3>
              <span className={styles.kpiSubGreen}>Activated</span>
            </div>
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiPurple}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiTitle}>Total Downline Left</span>
            <div className={styles.kpiValueWrapper}>
              <h3 className={styles.kpiNumber}>{stats.leftCount || 0}</h3>
              <span className={styles.kpiSub}>Unlimited Depth</span>
            </div>
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiAmber}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiTitle}>Total Downline Right</span>
            <div className={styles.kpiValueWrapper}>
              <h3 className={styles.kpiNumber}>{stats.rightCount || 0}</h3>
              <span className={styles.kpiSub}>Unlimited Depth</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container: search/filter toolbar + one collapsible box per generation */}
      <div className={styles.mainCard}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="Search member name or Member ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.filterGroup}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={styles.statusSelect}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Members</option>
              <option value="INACTIVE">Inactive Members</option>
            </select>

            <button
              type="button"
              className={styles.refreshBtn}
              onClick={fetchTeamData}
            >
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className={styles.centerBox}>
            <div className={styles.glowSpinner}></div>
            <p className={styles.loadingText}>Syncing network members...</p>
          </div>
        ) : genTotals.totalTeam === 0 ? (
          <div className={styles.centerBox}>
            <h4 className={styles.emptyTitle}>No Members Found</h4>
            <p className={styles.emptyDesc}>Share your referral link to start building your First Level Member box.</p>
          </div>
        ) : isFiltering && totalVisibleMembers === 0 ? (
          <div className={styles.centerBox}>
            <h4 className={styles.emptyTitle}>No Matches Found</h4>
            <p className={styles.emptyDesc}>Try adjusting your search term or status filter.</p>
          </div>
        ) : (
          filteredLevels.map((lvl) => {
            // While actively searching/filtering, only show generations with a
            // match, and force them open so results are never hidden behind a
            // collapsed box.
            if (isFiltering && lvl.members.length === 0) return null;
            const isOpen = isFiltering ? true : !!expandedLevels[lvl.level];
            // Business rule: "Direct Referral" and "First Level" are the same
            // thing, so level 1 is no longer treated as a separate "DR" box —
            // every generation, including the first, is just "L<level>" now,
            // matching the "First Level Member" ... "Tenth Level Member"
            // labels that come from the backend.
            const isDirect = false;

            return (
              <div key={lvl.level} className={styles.levelSection}>
                <div
                  className={styles.levelSectionHeader}
                  onClick={() => toggleLevel(lvl.level)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') toggleLevel(lvl.level);
                  }}
                >
                  <div className={styles.levelHeaderLeft}>
                    <span className={`${styles.levelBadge} ${isDirect ? styles.levelDirectBadge : ''}`}>
                      {`L${lvl.level}`}
                    </span>
                    <span className={styles.levelTitleText}>{lvl.label}</span>
                    <span className={`${styles.levelCountPill} ${lvl.members.length > 0 ? styles.levelCountPillActive : ''}`}>
                      {isFiltering ? `${lvl.members.length} of ${lvl.originalCount}` : lvl.count}{' '}
                      {lvl.count === 1 && !isFiltering ? 'Member' : 'Members'}
                    </span>
                  </div>
                  <svg
                    className={`${styles.levelChevron} ${isOpen ? styles.levelChevronOpen : ''}`}
                    width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>

                {isOpen && (
                  <div className={styles.levelSectionBody}>
                    {lvl.members.length === 0 ? (
                      <div className={styles.levelEmptyState}>
                        No members in this generation yet.
                      </div>
                    ) : (
                      <div className={styles.tableResponsive}>
                        <table className={styles.customTable}>
                          <thead>
                            <tr>
                              <th className={styles.thSl}>SL</th>
                              <th className={styles.thMember}>MEMBER</th>
                              <th className={styles.thPosition}>POSITION</th>
                              <th className={styles.thStatus}>STATUS</th>
                              <th className={styles.thAction}>VIEW MEMBER</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lvl.members.map((member, index) => {
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
                                        <span className={styles.memberIdSubText}>{member.memberId}</span>
                                      </div>
                                    </div>
                                  </td>

                                  <td className={styles.tdPosition}>
                                    <span className={`${styles.positionPill} ${member.position === 'R' ? styles.positionRight : styles.positionLeft}`}>
                                      {member.position}
                                    </span>
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
                                      onClick={() => setViewMember(member)}
                                    >
                                      <span>View</span>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="3"></circle>
                                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"></path>
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
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Basic Details Popup for a single member */}
      {viewMember && (
        <div className={styles.modalBackdrop} onClick={() => setViewMember(null)}>
          <div className={styles.modalWindow} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTopBanner}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalCategoryTag}>MEMBER BASIC DETAILS</span>
                <h3>{viewMember.fullName}</h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseIconBtn}
                onClick={() => setViewMember(null)}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalInnerBody}>
              <div className={styles.profileHero}>
                <div className={`${styles.largeAvatar} ${viewMember.status === 'ACTIVE' ? styles.avatarActive : styles.avatarInactive}`}>
                  {(viewMember.fullName || 'M').charAt(0).toUpperCase()}
                </div>
                <h4 className={styles.heroName}>{viewMember.fullName}</h4>
                <span className={viewMember.status === 'ACTIVE' ? styles.badgeActiveHero : styles.badgeInactiveHero}>
                  {viewMember.status}
                </span>
              </div>

              <div className={styles.coreCredentialsCard}>
                <div className={styles.credentialRow}>
                  <div className={styles.credentialLabelBlock}>
                    <span className={styles.credIcon}>🆔</span>
                    <span className={styles.credLabel}>Member ID</span>
                  </div>
                  <div
                    className={styles.memberIdChip}
                    onClick={() => copyToClipboard(viewMember.memberId)}
                    title="Click to copy"
                  >
                    <code>{viewMember.memberId}</code>
                    {copiedId && <span className={styles.copyNotice}>Copied!</span>}
                  </div>
                </div>

                <div className={styles.credentialRow}>
                  <div className={styles.credentialLabelBlock}>
                    <span className={styles.credIcon}>✉️</span>
                    <span className={styles.credLabel}>Email</span>
                  </div>
                  <span className={styles.credValueEmail}>{viewMember.email || '—'}</span>
                </div>

                <div className={styles.credentialRow}>
                  <div className={styles.credentialLabelBlock}>
                    <span className={styles.credIcon}>📞</span>
                    <span className={styles.credLabel}>Phone</span>
                  </div>
                  <span className={styles.credValuePrimary}>{viewMember.phoneNumber || '—'}</span>
                </div>

                <div className={styles.credentialRow}>
                  <div className={styles.credentialLabelBlock}>
                    <span className={styles.credIcon}>🤝</span>
                    <span className={styles.credLabel}>Sponsor</span>
                  </div>
                  <span className={styles.credValuePrimary}>
                    {viewMember.sponsorName} ({viewMember.sponsorMemberId})
                  </span>
                </div>

                <div className={styles.credentialRow}>
                  <div className={styles.credentialLabelBlock}>
                    <span className={styles.credIcon}>📦</span>
                    <span className={styles.credLabel}>Package</span>
                  </div>
                  <span className={styles.credValuePrimary}>{viewMember.packageName}</span>
                </div>
              </div>

              <div className={styles.secondaryGrid}>
                <div className={styles.secondaryTile}>
                  <small>Position</small>
                  <strong className={styles.sideHighlight}>{viewMember.positionLabel} ({viewMember.position})</strong>
                </div>
                <div className={styles.secondaryTile}>
                  <small>Generation</small>
                  <strong>
                    {`Level ${viewMember.level}`}
                  </strong>
                </div>
                <div className={styles.secondaryTile}>
                  <small>Package KBP</small>
                  <strong>{viewMember.kbp ? `₹${viewMember.kbp}` : '—'}</strong>
                </div>
                <div className={styles.secondaryTile}>
                  <small>Package Price</small>
                  <strong>{viewMember.packagePrice ? `₹${viewMember.packagePrice}` : '—'}</strong>
                </div>
                <div className={styles.secondaryTile}>
                  <small>Activation Date</small>
                  <strong>{formatDate(viewMember.activationDate)}</strong>
                </div>
                <div className={styles.secondaryTile}>
                  <small>Joined Date</small>
                  <strong>{formatDate(viewMember.joinedDate)}</strong>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.modalDoneBtn}
                  onClick={() => setViewMember(null)}
                >
                  Close
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
