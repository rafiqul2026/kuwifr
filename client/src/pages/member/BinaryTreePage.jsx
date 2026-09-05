// client/src/pages/member/BinaryTreePage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import styles from './BinaryTreePage.module.css';

/**
 * Recursive Binary Tree Node component supporting unlimited depth with spillover.
 */
const BinaryTreeNode = ({ node, onSelectNode, isRoot = false }) => {
  if (!node) {
    return (
      <div className={styles.treeBranch}>
        <div className={`${styles.nodeCard} ${styles.emptyNodeCard}`}>
          <div className={styles.emptyIcon}>+</div>
          <span className={styles.emptyText}>Empty Slot</span>
        </div>
      </div>
    );
  }

  const isActive = (node.status || '').toUpperCase() === 'ACTIVE';
  const roleName = node.currentPackage || node.package || (isActive ? 'Active Plan' : 'Inactive');

  return (
    <div className={styles.treeBranch}>
      {/* Member Card */}
      <div
        className={`${styles.nodeCard} ${isRoot ? styles.rootNodeCard : ''} ${
          isActive ? styles.activeNodeCard : styles.inactiveNodeCard
        }`}
        onClick={() => onSelectNode(node)}
        title="Click to focus downline tree on this member"
      >
        <div className={styles.nodeAvatar}>
          {isActive ? '👑' : '👤'}
        </div>
        <div className={styles.nodeBody}>
          <div className={styles.nodeIdBadge}>{node.memberId}</div>
          <strong className={styles.nodeName}>{node.fullName || node.name}</strong>
          <span className={styles.nodePkg}>{roleName}</span>
        </div>

        {/* Binary Leg Volume Tracker */}
        <div className={styles.nodePills}>
          <span className={styles.leftPill}>L: {node.leftKbp || 0}</span>
          <span className={styles.rightPill}>R: {node.rightKbp || 0}</span>
        </div>
      </div>

      {/* Render children subtrees if either left or right exists */}
      {(node.left || node.right) && (
        <div className={styles.childrenContainer}>
          <div className={styles.connectorLineDown}></div>
          <div className={styles.childrenRow}>
            {/* Left Subtree & Spillover */}
            <div className={styles.childColumn}>
              <span className={styles.positionBadgeLeft}>LEFT</span>
              <BinaryTreeNode node={node.left} onSelectNode={onSelectNode} />
            </div>

            {/* Right Subtree & Spillover */}
            <div className={styles.childColumn}>
              <span className={styles.positionBadgeRight}>RIGHT</span>
              <BinaryTreeNode node={node.right} onSelectNode={onSelectNode} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const BinaryTreePage = () => {
  const [treeData, setTreeData] = useState(null);
  const [currentRootMemberId, setCurrentRootMemberId] = useState(null);
  const [summaryStats, setSummaryStats] = useState({
    totalKbp: 0,
    leftKbp: 0,
    rightKbp: 0,
    matchingVolume: 0,
    totalPairs: 0
  });
  const [loading, setLoading] = useState(true);
  const [zoomScale, setZoomScale] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const { user } = useAuth();
  const { showNotification } = useNotification();
  const treeContainerRef = useRef(null);

  // Fetch binary network tree without depth limits
  const fetchBinaryTree = useCallback(
    async (targetMemberId = null) => {
      try {
        setLoading(true);
        const resolvedId = targetMemberId || user?.memberId;
        const queryParam = resolvedId ? `?memberId=${encodeURIComponent(resolvedId)}` : '';
        const res = await api.get(`/api/users/binary-tree${queryParam}`);

        if (res.data?.success) {
          const root = res.data.data?.root || res.data.data?.tree || res.data.data;
          setTreeData(root);

          if (root?.memberId) {
            setCurrentRootMemberId(root.memberId);
          }

          // Sync KPI metrics
          if (res.data.data?.summary) {
            const s = res.data.data.summary;
            setSummaryStats({
              totalKbp: Number(s.totalKbp || 0),
              leftKbp: Number(s.leftKbp || 0),
              rightKbp: Number(s.rightKbp || 0),
              matchingVolume: Number(s.matchingVolume || 0),
              totalPairs: Number(s.totalPairs || 0)
            });
          }
        } else {
          showNotification(res.data?.message || 'Unable to load binary tree.', 'error');
        }
      } catch (err) {
        console.error('Binary Tree Fetch Error:', err);
        showNotification('Failed to fetch live binary tree data.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [user, showNotification]
  );

  // Initial load on mount or user login
  useEffect(() => {
    if (user?.memberId) {
      setCurrentRootMemberId(user.memberId);
      fetchBinaryTree(user.memberId);
    }
  }, [user, fetchBinaryTree]);

  // Drill down by clicking any child node
  const handleSelectNode = (clickedNode) => {
    if (clickedNode?.memberId) {
      fetchBinaryTree(clickedNode.memberId);
    }
  };

  // Reset view back to the logged-in member's root node
  const handleResetToMyRoot = () => {
    if (user?.memberId) {
      fetchBinaryTree(user.memberId);
    }
  };

  // Jump to specific Member ID via search
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      fetchBinaryTree(searchQuery.trim().toUpperCase());
      setSearchQuery('');
    }
  };

  // Scale zoom
  const handleZoom = (delta) => {
    setZoomScale((prev) => Math.min(Math.max(Number((prev + delta).toFixed(1)), 0.4), 1.8));
  };

  return (
    <div className={styles.pageContainer}>
      {/* Top Banner & Controls */}
      <header className={styles.headerBar}>
        <div className={styles.titleWrap}>
          <div className={styles.tagGroup}>
            <span className={styles.treeTag}>🌲 Unlimited Depth Binary Network</span>
            {user?.memberId && currentRootMemberId && currentRootMemberId !== user.memberId && (
              <button
                type="button"
                onClick={handleResetToMyRoot}
                className={styles.resetRootBtn}
              >
                ← Back to My Root ({user.memberId})
              </button>
            )}
          </div>
          <h1 className={styles.pageTitle}>Binary Tree Network</h1>
          <p className={styles.pageSubtitle}>
            1st Pair = <strong>2:1 or 1:2</strong> (2 Directs Required) • Kuwi Star = <strong>3 Directs</strong> • Next <strong>1:1 Matching</strong> to Unlimited Depth.
          </p>
        </div>

        {/* Actions: Search, Zoom, Sync */}
        <div className={styles.headerTools}>
          <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
            <input
              type="text"
              placeholder="Search Member ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            <button type="submit" className={styles.searchBtn} aria-label="Search">🔍</button>
          </form>

          <div className={styles.zoomButtonGroup}>
            <button type="button" onClick={() => handleZoom(0.1)} className={styles.toolBtn} title="Zoom In">+</button>
            <button type="button" onClick={() => setZoomScale(1)} className={styles.toolBtn} title="Reset Scale">100%</button>
            <button type="button" onClick={() => handleZoom(-0.1)} className={styles.toolBtn} title="Zoom Out">−</button>
          </div>

          <button
            type="button"
            onClick={() => fetchBinaryTree(currentRootMemberId || user?.memberId)}
            className={styles.syncBtn}
          >
            🔄 Sync Tree
          </button>
        </div>
      </header>

      {/* KPI Volume Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>TOTAL KBP VOLUME</span>
          <h2 className={styles.kpiValueDark}>{summaryStats.totalKbp.toLocaleString()}</h2>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>LEFT VOLUME (KBP)</span>
          <h2 className={styles.kpiValueBlue}>{summaryStats.leftKbp.toLocaleString()}</h2>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>RIGHT VOLUME (KBP)</span>
          <h2 className={styles.kpiValuePink}>{summaryStats.rightKbp.toLocaleString()}</h2>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>MATCHING VOLUME</span>
          <h2 className={styles.kpiValueGreen}>{summaryStats.matchingVolume.toLocaleString()}</h2>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>TOTAL PAIRS MATCHED</span>
          <h2 className={styles.kpiValueOrange}>{summaryStats.totalPairs} Pairs</h2>
        </div>
      </div>

      {/* Tree Viewport */}
      <div className={styles.treeCanvasWrapper} ref={treeContainerRef}>
        {loading ? (
          <div className={styles.treeLoading}>
            <div className={styles.spinner}></div>
            <p>Building binary downline network...</p>
          </div>
        ) : !treeData ? (
          <div className={styles.emptyState}>
            <span>🌐</span>
            <h3>No Binary Placement Found</h3>
            <p>Activate your membership or purchase an activation package to start your binary tree.</p>
          </div>
        ) : (
          <div
            className={styles.treeScaleArea}
            style={{ transform: `scale(${zoomScale})`, transformOrigin: 'top center' }}
          >
            <BinaryTreeNode
              node={treeData}
              onSelectNode={handleSelectNode}
              isRoot={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default BinaryTreePage;