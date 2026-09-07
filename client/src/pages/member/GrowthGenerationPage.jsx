// client/src/pages/member/GrowthGenerationPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import styles from './GrowthGenerationPage.module.css';

/**
 * Modern Slim Curved Connector matching enterprise genealogy layouts (1.2px)
 */
const TreeBranchConnector = () => {
  return (
    <div className={styles.svgConnectorWrapper} aria-hidden="true">
      <svg
        className={styles.branchSvg}
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="leftLegGradient" x1="50%" y1="0%" x2="25%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="rightLegGradient" x1="50%" y1="0%" x2="75%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
        </defs>

        {/* Stem down from Parent */}
        <line x1="50" y1="0" x2="50" y2="14" className={styles.parentStemLine} />

        {/* Left Leg: Slim graceful curve to Left child */}
        <path
          d="M 50 14 C 50 24, 25 20, 25 40"
          fill="none"
          stroke="url(#leftLegGradient)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* Right Leg: Slim graceful curve to Right child */}
        <path
          d="M 50 14 C 50 24, 75 20, 75 40"
          fill="none"
          stroke="url(#rightLegGradient)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

/**
 * Member Node Box
 */
const GrowthGenerationNode = ({ node, level = 1, onNodeClick, onMouseEnter, onMouseLeave }) => {
  const isVacant = !node || node.isVacant;

  return (
    <div className={styles.treeBranchContainer}>
      {/* Node Identity Card */}
      <div
        className={`${styles.nodeBox} ${isVacant ? styles.nodeVacant : styles.nodeActive}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!isVacant) onNodeClick(node);
        }}
        onMouseEnter={(e) => !isVacant && onMouseEnter(e, node)}
        onMouseLeave={onMouseLeave}
        title={isVacant ? 'Vacant Position' : `Click to view ${node.fullName}'s growth generation`}
      >
        <div className={styles.avatarPill}>
          {isVacant ? (
            <span className={styles.vacantPlus}>+</span>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className={styles.memberSvg}>
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          )}
        </div>

        <div className={styles.nodeLabels}>
          <span className={styles.nodeName}>
            {isVacant ? 'Vacant' : node.fullName}
          </span>
          <strong className={styles.nodeId}>
            {isVacant ? 'Open Spot' : node.memberId}
          </strong>
        </div>
      </div>

      {/* Downline Sub-branches */}
      {!isVacant && level < 4 && (
        <div className={styles.treeChildrenCluster}>
          <TreeBranchConnector />

          <div className={styles.childrenRow}>
            {/* Left Child Leg */}
            <div className={styles.childLegColumn}>
              <div className={styles.legIndicatorWrapper}>
                <span className={styles.legBadgeLeft}>L</span>
              </div>
              <GrowthGenerationNode
                node={node.left || { isVacant: true }}
                level={level + 1}
                onNodeClick={onNodeClick}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
              />
            </div>

            {/* Right Child Leg */}
            <div className={styles.childLegColumn}>
              <div className={styles.legIndicatorWrapper}>
                <span className={styles.legBadgeRight}>R</span>
              </div>
              <GrowthGenerationNode
                node={node.right || { isVacant: true }}
                level={level + 1}
                onNodeClick={onNodeClick}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 🔢 Deep Recursive Counter for all registered members in a branch (excludes vacant spots)
 */
const countRegisteredMembers = (branchRoot) => {
  if (!branchRoot || branchRoot.isVacant || !branchRoot.memberId) return 0;
  return 1 + countRegisteredMembers(branchRoot.left) + countRegisteredMembers(branchRoot.right);
};

const GrowthGenerationPage = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [rootNode, setRootNode] = useState(null);
  const [currentRootId, setCurrentRootId] = useState(null);
  const [historyStack, setHistoryStack] = useState([]);
  const [searchMemberId, setSearchMemberId] = useState('');
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const fetchGrowthGeneration = useCallback(async (targetId = '') => {
    try {
      setLoading(true);
      const query = targetId ? `?memberId=${encodeURIComponent(targetId.trim())}` : '';
      const res = await api.get(`/api/users/binary-tree${query}`);

      if (res.data?.success && (res.data?.data?.tree || res.data?.data?.root)) {
        const tree = res.data.data.tree || res.data.data.root;
        setRootNode(tree);
        setCurrentRootId(tree.memberId);
      } else {
        showNotification('Member ID not found in your downline network', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load Growth Generation';
      showNotification(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchGrowthGeneration();
  }, [fetchGrowthGeneration]);

  const handleNodeClick = (node) => {
    if (!node || node.isVacant) return;
    if (node.memberId === currentRootId) return;

    setHistoryStack((prev) => [...prev, currentRootId]);
    fetchGrowthGeneration(node.memberId);
  };

  const handleReturnToMyRoot = () => {
    setHistoryStack([]);
    setSearchMemberId('');
    fetchGrowthGeneration('');
  };

  const handleUpOneLevel = () => {
    if (historyStack.length === 0) return;
    const stackCopy = [...historyStack];
    const previousId = stackCopy.pop();
    setHistoryStack(stackCopy);
    fetchGrowthGeneration(previousId);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const cleanId = searchMemberId.trim().toUpperCase();
    if (!cleanId) return;

    setHistoryStack((prev) => [...prev, currentRootId]);
    fetchGrowthGeneration(cleanId);
  };

  const handleMouseEnter = (e, node) => {
    if (!node || node.isVacant) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: rect.left + window.scrollX + rect.width / 2,
      y: rect.bottom + window.scrollY + 8
    });
    setHoveredNode(node);
  };

  const handleMouseLeave = () => {
    setHoveredNode(null);
  };

  const formatKBP = (val) => `${(Number(val) || 0).toLocaleString('en-IN')} KBP`;

  // --------------------------------------------------------------------------
  // Exact Registered Member Counts in Left and Right branches of Root
  // --------------------------------------------------------------------------
  const memberCounts = useMemo(() => {
    if (!rootNode) return { left: 0, right: 0 };
    return {
      left: countRegisteredMembers(rootNode.left),
      right: countRegisteredMembers(rootNode.right)
    };
  }, [rootNode]);

  return (
    <div className={styles.pageScene}>
      {/* Header Block */}
      <div className={styles.headerBlock}>
        <div className={styles.headerTitleGroup}>
          <span className={styles.pillBadge}>NETWORK STRUCTURE</span>
          <h1 className={styles.pageTitle}>Growth Generation</h1>
          <p className={styles.pageSubtitle}>
            Interactive dual-leg network structure. Click any member to expand their growth generation.
          </p>
        </div>

        <div className={styles.headerControls}>
          {historyStack.length > 0 && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={handleUpOneLevel}
            >
              ← Up One Level
            </button>
          )}

          {currentRootId !== user?.memberId && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.btnPrimary}`}
              onClick={handleReturnToMyRoot}
            >
              🏠 My Root
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Card */}
      <div className={styles.mainCanvasCard}>
        {/* Search Toolbar */}
        <div className={styles.toolbar}>
          <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
            <label htmlFor="memberIdInput" className={styles.searchLabel}>
              Enter Member ID:
            </label>
            <input
              id="memberIdInput"
              type="text"
              placeholder="e.g. KFR437046"
              value={searchMemberId}
              onChange={(e) => setSearchMemberId(e.target.value)}
              className={styles.searchInput}
            />
            <button type="submit" className={styles.searchBtn}>
              Submit
            </button>
          </form>
        </div>

        {/* Reference Legend: Member Left : X and Member Right : Y */}
        <div className={styles.legendSummaryRow}>
          <div className={styles.legendLeft}>
            <strong>Member Left : </strong>
            <span>{memberCounts.left}</span>
          </div>

          <div className={styles.legendRight}>
            <strong>Member Right : </strong>
            <span>{memberCounts.right}</span>
          </div>
        </div>

        {/* Tree Stage Viewport */}
        <div className={styles.stageViewport}>
          {loading ? (
            <div className={styles.centerState}>
              <div className={styles.spinner}></div>
              <p>Rendering Growth Generation...</p>
            </div>
          ) : rootNode ? (
            <div className={styles.treeWrapper}>
              <GrowthGenerationNode
                node={rootNode}
                level={1}
                onNodeClick={handleNodeClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              />
            </div>
          ) : (
            <div className={styles.centerState}>
              <p>No network structure records available.</p>
            </div>
          )}
        </div>
      </div>

      {/* Hover Tooltip Card */}
      {hoveredNode && (
        <div
          className={styles.detailTooltip}
          style={{ top: `${tooltipPos.y}px`, left: `${tooltipPos.x}px` }}
        >
          <div className={styles.tooltipHeader}>
            <strong>Member Overview</strong>
            <span className={hoveredNode.status === 'ACTIVE' ? styles.statusActive : styles.statusInactive}>
              ● {hoveredNode.status || 'ACTIVE'}
            </span>
          </div>
          <div className={styles.tooltipBody}>
            <div className={styles.tooltipRow}>
              <span>Full Name:</span>
              <strong>{hoveredNode.fullName}</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>Member ID:</span>
              <strong className={styles.monoId}>{hoveredNode.memberId}</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>Sponsor ID:</span>
              <strong className={styles.monoId}>{hoveredNode.sponsorId || 'ROOT'}</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>Package:</span>
              <strong>{hoveredNode.currentPackage || 'Starter Package'}</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>Personal KBP:</span>
              <strong>{formatKBP(hoveredNode.personalKbp || 0)}</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>Left Volume:</span>
              <strong className={styles.leftVol}>{formatKBP(hoveredNode.leftKbp || 0)}</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>Right Volume:</span>
              <strong className={styles.rightVol}>{formatKBP(hoveredNode.rightKbp || 0)}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GrowthGenerationPage;