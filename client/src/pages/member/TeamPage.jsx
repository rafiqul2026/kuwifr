// client/src/pages/member/TeamPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
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
  const [sponsorInfo, setSponsorInfo] = useState({
    fullName: 'Direct Company Root',
    memberId: 'ROOT'
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Downline Branch Inspection Modal State
  const [selectedMemberBranch, setSelectedMemberBranch] = useState(null);
  const [branchTab, setBranchTab] = useState('LEFT');
  const [branchLoading, setBranchLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const fetchTeamData = useCallback(async () => {
    try {
      setLoading(true);
      const [teamRes, statsRes, profileRes] = await Promise.all([
        api.get('/api/users/team'),
        api.get('/api/users/team-stats'),
        api.get('/api/users/profile')
      ]);

      if (teamRes.data?.success && teamRes.data?.data) {
        setTeamMembers(teamRes.data.data.team || []);
      }
      if (statsRes.data?.success && statsRes.data?.data) {
        setStats(statsRes.data.data);
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

  // Fetch unlimited depth branch downline counts and lists for any member
  const handleViewBranchDownline = async (memberMongoId) => {
    try {
      setBranchLoading(true);
      const res = await api.get(`/api/team/overview?userId=${memberMongoId}`);
      if (res.data?.success && res.data?.data) {
        setSelectedMemberBranch(res.data.data);
        setBranchTab('LEFT');
      }
    } catch {
      showNotification('Failed to fetch downline branch details', 'error');
    } finally {
      setBranchLoading(false);
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

  const currentBranchList = branchTab === 'LEFT' 
    ? (selectedMemberBranch?.leftMembers || []) 
    : (selectedMemberBranch?.rightMembers || []);

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
              {stats.totalTeam || teamMembers.length}
              <span className={styles.unitText}>Members</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className={styles.metricsGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiBlue}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiTitle}>Direct Referrals</span>
            <div className={styles.kpiValueWrapper}>
              <h3 className={styles.kpiNumber}>{stats.directReferrals || teamMembers.length}</h3>
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
            <span className={styles.kpiTitle}>Total Downline</span>
            <div className={styles.kpiValueWrapper}>
              <h3 className={styles.kpiNumber}>{stats.totalTeam || teamMembers.length}</h3>
              <span className={styles.kpiSub}>10 Generations</span>
            </div>
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiAmber}`}>
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
        ) : filteredMembers.length === 0 ? (
          <div className={styles.centerBox}>
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
                  <th className={styles.thAction}>BRANCH DOWNLINE</th>
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
                            <span className={styles.memberIdSubText}>{member.memberId}</span>
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
                          onClick={() => handleViewBranchDownline(member._id)}
                          disabled={branchLoading}
                        >
                          <span>Inspect Branch</span>
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

      {/* Unlimited Depth Branch Inspection Modal (Growth Generation Style) */}
      {selectedMemberBranch && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedMemberBranch(null)}>
          <div className={styles.modalWindow} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', width: '95%' }}>
            <div className={styles.modalTopBanner}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalCategoryTag}>BINARY DOWNLINE ANALYSIS</span>
                <h3>{selectedMemberBranch.user?.fullName} ({selectedMemberBranch.user?.memberId})</h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseIconBtn}
                onClick={() => setSelectedMemberBranch(null)}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalInnerBody}>
              {/* Left / Right Summary Cards matching Growth Generation */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div 
                  onClick={() => setBranchTab('LEFT')}
                  style={{ background: branchTab === 'LEFT' ? '#eff6ff' : '#f8fafc', border: branchTab === 'LEFT' ? '2px solid #2563eb' : '1px solid #e2e8f0', padding: '15px', borderRadius: '10px', textAlign: 'center', cursor: 'pointer' }}
                >
                  <h4 style={{ margin: '0 0 5px 0', color: '#64748b', fontSize: '13px' }}>Member Left (Unlimited Depth)</h4>
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{selectedMemberBranch.leftCount}</span>
                </div>
                <div 
                  onClick={() => setBranchTab('RIGHT')}
                  style={{ background: branchTab === 'RIGHT' ? '#eff6ff' : '#f8fafc', border: branchTab === 'RIGHT' ? '2px solid #2563eb' : '1px solid #e2e8f0', padding: '15px', borderRadius: '10px', textAlign: 'center', cursor: 'pointer' }}
                >
                  <h4 style={{ margin: '0 0 5px 0', color: '#64748b', fontSize: '13px' }}>Member Right (Unlimited Depth)</h4>
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{selectedMemberBranch.rightCount}</span>
                </div>
              </div>

              {/* Branch Switcher Tabs */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <button
                  type="button"
                  onClick={() => setBranchTab('LEFT')}
                  style={{ flex: 1, padding: '10px', fontWeight: 'bold', background: branchTab === 'LEFT' ? '#2563eb' : '#e2e8f0', color: branchTab === 'LEFT' ? '#fff' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Left Branch List ({selectedMemberBranch.leftCount})
                </button>
                <button
                  type="button"
                  onClick={() => setBranchTab('RIGHT')}
                  style={{ flex: 1, padding: '10px', fontWeight: 'bold', background: branchTab === 'RIGHT' ? '#2563eb' : '#e2e8f0', color: branchTab === 'RIGHT' ? '#fff' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Right Branch List ({selectedMemberBranch.rightCount})
                </button>
              </div>

              {/* Downline Members Table */}
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '10px' }}>#</th>
                      <th style={{ padding: '10px' }}>Member Name</th>
                      <th style={{ padding: '10px' }}>Member ID</th>
                      <th style={{ padding: '10px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentBranchList.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                          No members registered on this side downline.
                        </td>
                      </tr>
                    ) : (
                      currentBranchList.map((m, idx) => (
                        <tr key={m._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px' }}>#{idx + 1}</td>
                          <td style={{ padding: '10px' }}><strong>{m.fullName}</strong></td>
                          <td style={{ padding: '10px' }}>
                            <code style={{ background: '#f8fafc', padding: '2px 6px', borderRadius: '4px' }} onClick={() => copyToClipboard(m.memberId)} title="Click to copy">
                              {m.memberId}
                            </code>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', background: m.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2', color: m.status === 'ACTIVE' ? '#166534' : '#991b1b' }}>
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className={styles.modalFooter} style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className={styles.modalDoneBtn}
                  onClick={() => setSelectedMemberBranch(null)}
                >
                  Close Inspection
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