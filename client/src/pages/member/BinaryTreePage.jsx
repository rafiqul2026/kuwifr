// client/src/pages/member/BinaryTreePage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import styles from './BinaryTreePage.module.css';

/**
 * Compact recursive binary tree node with responsive styling
 */
const BinaryTreeNode = ({ node, onSelectNode, isRoot = false }) => {
  if (!node) {
    return (
      <div className={styles.treeBranch}>
        <div className={`${styles.nodeCard} ${styles.emptyNodeCard}`}>
          <div className={styles.emptyIcon}>+</div>
          <span className={styles.emptyText}>Empty</span>
        </div>
      </div>
    );
  }

  const isActive = (node.status || '').toUpperCase() === 'ACTIVE';
  const roleName = node.currentPackage || node.package || (isActive ? 'Active Plan' : 'Inactive');

  return (
    <div className={styles.treeBranch}>
      {/* Compact Member Node Card */}
      <div
        className={`${styles.nodeCard} ${isRoot ? styles.rootNodeCard : ''} ${
          isActive ? styles.activeNodeCard : styles.inactiveNodeCard
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onSelectNode(node);
        }}
        title="Tap to focus on this member's subtree"
      >
        <div className={styles.nodeAvatar}>{isActive ? '👑' : '👤'}</div>
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

      {/* Render subtrees if either left or right child exists */}
      {(node.left || node.right) && (
        <div className={styles.childrenContainer}>
          <div className={styles.connectorLineDown}></div>
          <div className={styles.childrenRow}>
            {/* Left Subtree */}
            <div className={styles.childColumn}>
              <span className={styles.positionBadgeLeft}>LEFT</span>
              <BinaryTreeNode node={node.left} onSelectNode={onSelectNode} />
            </div>

            {/* Right Subtree */}
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
  const [searchQuery, setSearchQuery] = useState('');

  // Transform states: Scale & 2D Pan Positions
  const [zoomScale, setZoomScale] = useState(0.9);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });

  const { user } = useAuth();
  const { showNotification } = useNotification();

  // Gesture tracking refs
  const canvasRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startPanRef = useRef({ x: 0, y: 0 });
  const initialTouchDistRef = useRef(null);
  const initialScaleRef = useRef(1);

  // Fetch binary network from backend
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
        showNotification('Failed to load binary tree data.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [user, showNotification]
  );

  useEffect(() => {
    if (user?.memberId) {
      setCurrentRootMemberId(user.memberId);
      fetchBinaryTree(user.memberId);
    }
  }, [user, fetchBinaryTree]);

  // Touch Gesture Listeners (Pinch-to-zoom & Swipe-to-pan)
  const getTouchDistance = (e) => {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      // Two fingers -> Pinch to zoom
      initialTouchDistRef.current = getTouchDistance(e);
      initialScaleRef.current = zoomScale;
    } else if (e.touches.length === 1) {
      // Single finger -> Drag to pan
      isDraggingRef.current = true;
      startPanRef.current = {
        x: e.touches[0].clientX - panPosition.x,
        y: e.touches[0].clientY - panPosition.y
      };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && initialTouchDistRef.current) {
      // Handle pinch zoom
      const currentDist = getTouchDistance(e);
      const factor = currentDist / initialTouchDistRef.current;
      const newScale = Math.min(Math.max(initialScaleRef.current * factor, 0.4), 1.6);
      setZoomScale(Number(newScale.toFixed(2)));
    } else if (e.touches.length === 1 && isDraggingRef.current) {
      // Handle pan translation
      setPanPosition({
        x: e.touches[0].clientX - startPanRef.current.x,
        y: e.touches[0].clientY - startPanRef.current.y
      });
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    initialTouchDistRef.current = null;
  };

  // Mouse Drag Panning for Desktops
  const handleMouseDown = (e) => {
    // Only left click triggers panning
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    startPanRef.current = {
      x: e.clientX - panPosition.x,
      y: e.clientY - panPosition.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    setPanPosition({
      x: e.clientX - startPanRef.current.x,
      y: e.clientY - startPanRef.current.y
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Node Selection Handler
  const handleSelectNode = (clickedNode) => {
    if (clickedNode?.memberId) {
      setPanPosition({ x: 0, y: 0 }); // Re-center
      fetchBinaryTree(clickedNode.memberId);
    }
  };

  // Reset to personal root
  const handleResetToMyRoot = () => {
    if (user?.memberId) {
      setPanPosition({ x: 0, y: 0 });
      setZoomScale(0.9);
      fetchBinaryTree(user.memberId);
    }
  };

  // Search Submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setPanPosition({ x: 0, y: 0 });
      fetchBinaryTree(searchQuery.trim().toUpperCase());
      setSearchQuery('');
    }
  };

  return (
    <div className={styles.pageContainer}>
      {/* Top Banner */}
      <header className={styles.headerBar}>
        <div className={styles.titleWrap}>
          <div className={styles.tagGroup}>
            <span className={styles.treeTag}>🌲 Unlimited Depth Binary Network</span>
            {user?.memberId && currentRootMemberId && currentRootMemberId !== user.memberId && (
              <button type="button" onClick={handleResetToMyRoot} className={styles.resetRootBtn}>
                ← Back to My Root ({user.memberId})
              </button>
            )}
          </div>
          <h1 className={styles.pageTitle}>Binary Tree Network</h1>
          <p className={styles.pageSubtitle}>
            1st Pair = <strong>2:1 or 1:2</strong> (2 Directs Required) • Kuwi Star = <strong>3 Directs</strong> • Next <strong>1:1 Matching</strong> to Unlimited Depth.
          </p>
        </div>

        {/* Interactive Controls */}
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
            <button
              type="button"
              onClick={() => setZoomScale((prev) => Math.min(prev + 0.1, 1.6))}
              className={styles.toolBtn}
              title="Zoom In"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => {
                setZoomScale(0.9);
                setPanPosition({ x: 0, y: 0 });
              }}
              className={styles.toolBtn}
              title="Reset View"
            >
              Fit
            </button>
            <button
              type="button"
              onClick={() => setZoomScale((prev) => Math.max(prev - 0.1, 0.4))}
              className={styles.toolBtn}
              title="Zoom Out"
            >
              −
            </button>
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

      {/* Touch-Friendly Gestural Canvas */}
      <div
        className={styles.treeCanvasWrapper}
        ref={canvasRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className={styles.touchHintPill}>
          <span>👆 Drag to explore left/right • Pinch with 2 fingers to zoom</span>
        </div>

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
            style={{
              transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomScale})`,
              transformOrigin: 'top center'
            }}
          >
            <BinaryTreeNode node={treeData} onSelectNode={handleSelectNode} isRoot={true} />
          </div>
        )}
      </div>
    </div>
  );
};

export default BinaryTreePage;