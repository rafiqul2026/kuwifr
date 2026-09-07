// client/src/pages/member/GrowthGenerationPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import styles from './GrowthGenerationPage.module.css';

/**
 * 🌲 Classical Hierarchical Member Node Box
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

      {/* Hierarchical Connecting Lines & Downline Sub-branches (Renders 3 Full Generations) */}
      {!isVacant && level < 4 && (
        <div className={styles.treeChildrenCluster}>
          <div className={styles.branchVertical}></div>
          <div className={styles.branchHorizontal}></div>
          <div className={styles.childrenRow}>
            {/* Left Leg Sub-Branch */}
            <div className={styles.childLegColumn}>
              <div className={styles.subVertical}></div>
              <span className={styles.legBadgeLeft}>L</span>
              <GrowthGenerationNode
                node={node.left || { isVacant: true }}
                level={level + 1}
                onNodeClick={onNodeClick}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
              />
            </div>

            {/* Right Leg Sub-Branch */}
            <div className={styles.childLegColumn}>
              <div className={styles.subVertical}></div>
              <span className={styles.legBadgeRight}>R</span>
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

  // --------------------------------------------------------------------------
  // API: Fetch Growth Generation for target member ID
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // Drill-Down: Click any node to open their downline as root
  // --------------------------------------------------------------------------
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

  // Hover Tooltip
  const handleMouseEnter = (e, node) => {
    if (!node || node.isVacant) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: rect.left + window.scrollX + rect.width / 2,
      y: rect.bottom + window.scrollY + 10
    });
    setHoveredNode(node);
  };

  const handleMouseLeave = () => {
    setHoveredNode(null);
  };

  const formatKBP = (val) => `${(Number(val) || 0).toLocaleString('en-IN')} KBP`;

  return (
    <div className={styles.pageScene}>
      {/* Top Header Block */}
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

      {/* Main Glass Workspace */}
      <div className={styles.mainCanvasCard}>
        {/* Search Toolbar & Leg Volume Summary */}
        <div className={styles.toolbar}>
          <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
            <label htmlFor="memberIdInput" className={styles.searchLabel}>
              Jump to Member:
            </label>
            <input
              id="memberIdInput"
              type="text"
              placeholder="Enter Member ID (e.g. KFR437046)..."
              value={searchMemberId}
              onChange={(e) => setSearchMemberId(e.target.value)}
              className={styles.searchInput}
            />
            <button type="submit" className={styles.searchBtn}>
              Locate
            </button>
          </form>

          <div className={styles.volumeCounters}>
            <div className={styles.counterPillLeft}>
              <span className={styles.dotLeft}></span>
              Member Left: <strong>{rootNode?.leftKbp ? Math.floor(rootNode.leftKbp / 1000) : 0} Stars</strong> ({formatKBP(rootNode?.leftKbp || 0)})
            </div>
            <div className={styles.counterPillRight}>
              <span className={styles.dotRight}></span>
              Member Right: <strong>{rootNode?.rightKbp ? Math.floor(rootNode.rightKbp / 1000) : 0} Stars</strong> ({formatKBP(rootNode?.rightKbp || 0)})
            </div>
          </div>
        </div>

        {/* Tree Canvas Stage */}
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

      {/* Hover Tooltip (Classical MLM Style) */}
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