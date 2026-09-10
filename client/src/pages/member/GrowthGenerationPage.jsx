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
 * 🌲 Unlimited Depth Member Node Component
 * Recursively renders indefinitely whenever a left or right child node exists.
 */
const GrowthGenerationNode = ({ node, onNodeClick, onMouseEnter, onMouseLeave, parentNode }) => {
  const isVacant = !node || node.isVacant;
  // A "more" slot: the real child exists in the database but this response's
  // depth limit stopped short of fetching it (see hasMoreLeft/hasMoreRight
  // from the API) — distinct from a genuinely open/vacant position.
  const isMore = !!node?.isMore;

  // Every active member's two positions are always shown — including
  // genuinely open ones — so the tree reads as a complete binary structure
  // rather than stopping wherever a child happens to already exist.
  const showChildRow = !isVacant && !isMore;

  const handleClick = (e) => {
    e.stopPropagation();
    if (isMore) {
      // We don't know this child's identity yet (it's beyond the fetched
      // depth) — re-root on the parent, whose own fetch will include it.
      onNodeClick(parentNode);
      return;
    }
    if (!isVacant) onNodeClick(node);
  };

  return (
    <div className={styles.treeBranchContainer}>
      {/* Node Identity Card */}
      <div
        className={`${styles.nodeBox} ${isVacant ? styles.nodeVacant : ''} ${isMore ? styles.nodeMore : ''} ${!isVacant && !isMore ? styles.nodeActive : ''}`}
        onClick={handleClick}
        onMouseEnter={(e) => !isVacant && !isMore && onMouseEnter(e, node)}
        onMouseLeave={onMouseLeave}
        title={
          isMore
            ? 'This position already has a member — click to expand and view them'
            : isVacant
              ? 'Open Position — available for new placement'
              : `Click to view ${node.fullName}'s growth generation`
        }
      >
        <div className={styles.avatarPill}>
          {isMore ? (
            <span className={styles.morePlus}>⋯</span>
          ) : isVacant ? (
            <span className={styles.vacantPlus}>+</span>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className={styles.memberSvg}>
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          )}
        </div>

        <div className={styles.nodeLabels}>
          <span className={styles.nodeName}>
            {isMore ? 'View More' : isVacant ? 'Open Spot' : node.fullName}
          </span>
          <strong className={styles.nodeId}>
            {isMore ? 'Expand ↓' : isVacant ? '' : node.memberId}
          </strong>
        </div>
      </div>

      {/* Every active node's two positions render — vacant slots included —
          so the tree always shows a complete two-leg structure at each tier. */}
      {showChildRow && (
        <div className={styles.treeChildrenCluster}>
          <TreeBranchConnector />

          <div className={styles.childrenRow}>
            {/* Left Child Leg */}
            <div className={styles.childLegColumn}>
              <div className={styles.legIndicatorWrapper}>
                <span className={styles.legBadgeLeft}>L</span>
              </div>
              <GrowthGenerationNode
                node={node.left || (node.hasMoreLeft ? { isMore: true } : { isVacant: true })}
                parentNode={node}
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
                node={node.right || (node.hasMoreRight ? { isMore: true } : { isVacant: true })}
                parentNode={node}
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
 * Fallback-only: recursively counts registered members within whatever
 * portion of the tree was actually fetched. This UNDER-counts on its own —
 * the tree response is capped at a handful of generations per request for
 * payload size, so a member with a deeper downline than that cap would show
 * fewer members here than really exist. The real, unlimited-depth total
 * comes from the backend's `summary.leftCount`/`summary.rightCount`
 * (BinaryService.getBranchCounts, an unlimited-depth walk); this recursive
 * count is only used if an older API response doesn't include that summary.
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
  // True, unlimited-depth Left/Right totals from the backend — see the
  // comment on countRegisteredMembers above for why these can't be derived
  // from the (depth-capped) fetched tree alone.
  const [branchCounts, setBranchCounts] = useState(null);

  // Zoom scale for the tree canvas. "The Growth Generation Map is showing
  // very big" was reported as hard to use, especially on mobile — a deep
  // tree can be several thousand pixels wide. Rather than shrink node sizes
  // to the point of being unreadable, the canvas now starts smaller on
  // narrow screens and offers Zoom In/Out/Reset so a member can fit more of
  // their tree on screen at once and zoom in only where they need detail.
  const getDefaultZoom = () => {
    if (typeof window === 'undefined') return 1;
    if (window.innerWidth <= 480) return 0.55;
    if (window.innerWidth <= 768) return 0.75;
    return 1;
  };
  const [zoom, setZoom] = useState(getDefaultZoom);

  const handleZoomIn = () => setZoom((z) => Math.min(1.25, Math.round((z + 0.15) * 100) / 100));
  const handleZoomOut = () => setZoom((z) => Math.max(0.35, Math.round((z - 0.15) * 100) / 100));
  const handleZoomReset = () => setZoom(getDefaultZoom());

  const fetchGrowthGeneration = useCallback(async (targetId = '') => {
    try {
      setLoading(true);
      const query = targetId ? `?memberId=${encodeURIComponent(targetId.trim())}` : '';
      const res = await api.get(`/api/users/binary-tree${query}`);

      if (res.data?.success && (res.data?.data?.tree || res.data?.data?.root)) {
        const tree = res.data.data.tree || res.data.data.root;
        setRootNode(tree);
        setCurrentRootId(tree.memberId);
        const summary = res.data.data.summary;
        if (summary && (summary.leftCount !== undefined || summary.rightCount !== undefined)) {
          setBranchCounts({ left: summary.leftCount || 0, right: summary.rightCount || 0 });
        } else {
          setBranchCounts(null);
        }
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

  const memberCounts = useMemo(() => {
    // Prefer the backend's true, unlimited-depth totals. Only fall back to
    // counting the fetched (depth-capped) tree if an older API response
    // didn't include them — that fallback can under-report a deep downline.
    if (branchCounts) return branchCounts;
    if (!rootNode) return { left: 0, right: 0 };
    return {
      left: countRegisteredMembers(rootNode.left),
      right: countRegisteredMembers(rootNode.right)
    };
  }, [rootNode, branchCounts]);

  return (
    <div className={styles.pageScene}>
      {/* Header Block */}
      <div className={styles.headerBlock}>
        <div className={styles.headerTitleGroup}>
          <span className={styles.pillBadge}>NETWORK STRUCTURE</span>
          <h1 className={styles.pageTitle}>Growth Generation</h1>
          <p className={styles.pageSubtitle}>
            Full infinite-depth dual-leg network structure. Click any member to focus their tree.
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

        {/* Legend Summary Row */}
        <div className={styles.legendSummaryRow}>
          <div className={styles.legendLeft}>
            <strong>Member Left : </strong>
            <span>{memberCounts.left}</span>
          </div>

          <div className={styles.legendRight}>
            <strong>Member Right : </strong>
            <span>{memberCounts.right}</span>
          </div>

          <div className={styles.legendLeft}>
            <strong>KBP Left : </strong>
            <span>{formatKBP(rootNode?.leftKbp || 0)}</span>
          </div>

          <div className={styles.legendRight}>
            <strong>KBP Right : </strong>
            <span>{formatKBP(rootNode?.rightKbp || 0)}</span>
          </div>

          <div className={styles.legendLeft}>
            <strong>Matched Pairs : </strong>
            <span>{rootNode?.pairCount || 0}</span>
          </div>
        </div>

        {/* Zoom Controls — fit a big/deep tree into view instead of forcing
            long horizontal scrolling, especially on mobile. */}
        <div className={styles.zoomControls}>
          <button type="button" className={styles.zoomBtn} onClick={handleZoomOut} aria-label="Zoom out" title="Zoom out">
            −
          </button>
          <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>
          <button type="button" className={styles.zoomBtn} onClick={handleZoomIn} aria-label="Zoom in" title="Zoom in">
            +
          </button>
          <button type="button" className={styles.zoomBtn} onClick={handleZoomReset} aria-label="Reset zoom" title="Reset zoom">
            ⟲
          </button>
        </div>

        {/* Tree Stage Viewport with Smooth Infinite Canvas */}
        <div className={styles.stageViewport}>
          {loading ? (
            <div className={styles.centerState}>
              <div className={styles.spinner}></div>
              <p>Rendering Growth Generation...</p>
            </div>
          ) : rootNode ? (
            <div className={styles.treeWrapper} style={{ transform: `scale(${zoom})` }}>
              <GrowthGenerationNode
                node={rootNode}
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