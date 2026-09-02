// client/src/pages/member/BinaryTreePage.jsx
import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../hooks/useNotification";
import styles from "./BinaryTreePage.module.css";

const BinaryTreePage = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [treeData, setTreeData] = useState(null);
  const [stats, setStats] = useState({
    totalKBP: 0,
    leftVolume: 0,
    rightVolume: 0,
    matchingVolume: 0,
    pairCount: 0,
  });
  const [depth, setDepth] = useState(3);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [rootViewId, setRootViewId] = useState(null);

  useEffect(() => {
    fetchTree();
  }, [depth, rootViewId]);

  const fetchTree = async () => {
    try {
      setLoading(true);
      const endpoint = rootViewId
        ? `/api/users/binary-tree?depth=${depth}&userId=${rootViewId}`
        : `/api/users/binary-tree?depth=${depth}`;

      const [treeRes, statsRes] = await Promise.all([
        api.get(endpoint),
        api.get("/api/users/team-stats"),
      ]);

      if (treeRes.data?.success) setTreeData(treeRes.data.data.tree);
      if (statsRes.data?.success) setStats(statsRes.data.data);
    } catch {
      showNotification("Failed to load binary tree", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncTree = async () => {
    try {
      setLoading(true);
      const res = await api.post("/api/users/reindex-binary");
      if (res.data?.success) {
        showNotification(res.data.message, "success");
        fetchTree();
      }
    } catch {
      showNotification("Failed to sync binary tree", "error");
      setLoading(false);
    }
  };

  const renderBinaryBranch = (node, isRoot = false) => {
    if (!node) {
      return (
        <div className={styles.vacantSlotBox}>
          <div className={styles.vacantCircle}>+</div>
          <span>Available</span>
        </div>
      );
    }

    const initials = (node.fullName || "Member")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const leftChild = node.children?.find(
      (c) => c.position === "left" && String(c.userId) !== String(node.userId)
    );
    const rightChild = node.children?.find(
      (c) => c.position === "right" && String(c.userId) !== String(node.userId)
    );

    return (
      <div className={styles.nodeBranchWrap}>
        {/* Node Card */}
        <div
          className={`${styles.nodeCard} ${isRoot ? styles.rootCard : ""}`}
          onClick={() => setSelectedNode(node)}
        >
          {isRoot && <span className={styles.rootBadge}>Root</span>}
          <div className={styles.nodeAvatar}>{initials}</div>
          <strong className={styles.nodeName}>{node.fullName}</strong>
          <span className={styles.nodeMemberId}>{node.memberId}</span>

          <div className={styles.nodeVolumesBar}>
            <span className={styles.leftVolumeText}>
              L: {node.leftVolume?.toLocaleString() || 0}
            </span>
            <span className={styles.volDivider}>|</span>
            <span className={styles.rightVolumeText}>
              R: {node.rightVolume?.toLocaleString() || 0}
            </span>
          </div>

          {!isRoot && (
            <button
              type="button"
              className={styles.drillDownBtn}
              onClick={(e) => {
                e.stopPropagation();
                setRootViewId(node.userId);
              }}
            >
              Zoom ↓
            </button>
          )}
        </div>

        {/* Children Sub-branches */}
        <div className={styles.childrenContainer}>
          <div className={styles.childLeg}>
            <span className={styles.legBadgeLeft}>LEFT</span>
            {renderBinaryBranch(leftChild, false)}
          </div>

          <div className={styles.childLeg}>
            <span className={styles.legBadgeRight}>RIGHT</span>
            {renderBinaryBranch(rightChild, false)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.binaryPageContainer}>
      {/* Header */}
      <header className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.headerPill}>
            🌳 Unlimited Depth Binary Network
          </span>
          <h1 className={styles.pageTitle}>Binary Tree Network</h1>
          <p className={styles.pageSubtitle}>
            1st Pair = <strong>2:1 or 1:2 (2 Directs Required)</strong> • Kuwi
            Star = <strong>3 Directs</strong> • Next{" "}
            <strong>1:1 Matching</strong> to Unlimited Depth.
          </p>
        </div>

        <div className={styles.controlsBar}>
          <div className={styles.selectGroup}>
            <label>Depth:</label>
            <select
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
            >
              <option value={2}>2 Levels</option>
              <option value={3}>3 Levels</option>
              <option value={4}>4 Levels</option>
              <option value={5}>5 Levels</option>
            </select>
          </div>

          {rootViewId && (
            <button
              type="button"
              className={styles.resetBtn}
              onClick={() => setRootViewId(null)}
            >
              Reset Root
            </button>
          )}

          <button
            type="button"
            className={styles.syncBtn}
            onClick={handleSyncTree}
          >
            🔄 Sync Tree
          </button>
        </div>
      </header>

      {/* Top 5 Metrics Cards */}
      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <small>Total KBP Volume</small>
          <h3>{stats.totalKBP?.toLocaleString() || 0}</h3>
        </div>
        <div className={styles.statCard} style={{ borderTopColor: "#3b82f6" }}>
          <small>Left Volume (KBP)</small>
          <h3 style={{ color: "#2563eb" }}>
            {stats.leftVolume?.toLocaleString() || 0}
          </h3>
        </div>
        <div className={styles.statCard} style={{ borderTopColor: "#ec4899" }}>
          <small>Right Volume (KBP)</small>
          <h3 style={{ color: "#ec4899" }}>
            {stats.rightVolume?.toLocaleString() || 0}
          </h3>
        </div>
        <div className={styles.statCard} style={{ borderTopColor: "#10b981" }}>
          <small>Matching Volume</small>
          <h3 style={{ color: "#10b981" }}>
            {stats.matchingVolume?.toLocaleString() || 0}
          </h3>
        </div>
        <div className={styles.statCard} style={{ borderTopColor: "#f59e0b" }}>
          <small>Total Pairs Matched</small>
          <h3 style={{ color: "#d97706" }}>{stats.pairCount || 0} Pairs</h3>
        </div>
      </section>

      {/* Responsive Viewport */}
      <div className={styles.treeViewportWrapper}>
        <div className={styles.treeCanvas}>
          {loading ? (
            <div className={styles.loadingBox}>
              <div className={styles.spinner}></div>
              <p>Rendering binary network...</p>
            </div>
          ) : treeData ? (
            renderBinaryBranch(treeData, true)
          ) : (
            <div className={styles.emptyState}>No binary placement found.</div>
          )}
        </div>
      </div>

      {/* ================= 4-TIER ORDER MODAL ================= */}
      {selectedNode && (
        <div
          className={styles.modalOverlay}
          onClick={() => setSelectedNode(null)}
        >
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3>Member Node Information</h3>
              <button type="button" onClick={() => setSelectedNode(null)}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalAvatar}>
                {selectedNode.fullName?.charAt(0) || "M"}
              </div>

              {/* Exact 4-Tier Order Layout */}
              <div className={styles.nodeIdentityStack}>
                {/* 1st: Member Name */}
                <h4 className={styles.memberNameMain}>
                  {selectedNode.fullName || "Member Name"}
                </h4>

                {/* 2nd: Email ID */}
                <p className={styles.memberEmailSub}>
                  {selectedNode.email || "No email available"}
                </p>

                {/* 3rd: Member User ID */}
                <div className={styles.idChipRow}>
                  <span className={styles.chipLabel}>User ID:</span>
                  <span className={styles.memberIdText}>
                    {selectedNode.memberId || "KFR------"}
                  </span>
                </div>

                {/* 4th: Sponsor ID */}
                <div className={styles.idChipRow}>
                  <span className={styles.chipLabel}>Sponsor ID:</span>
                  <span className={styles.sponsorIdText}>
                    {selectedNode.sponsorId || "Direct Root"}
                  </span>
                </div>

                {/* Unilevel Referral Level Indicator */}
                <div className={styles.generationLevelPill}>
                  {selectedNode.referralLevel === 0 ? (
                    <span className={styles.rootLevelBadge}>Network Root</span>
                  ) : selectedNode.referralLevel === 1 ? (
                    <span className={styles.directLevelBadge}>⭐ Direct Referral (Level 1)</span>
                  ) : (
                    <span className={styles.downlineLevelBadge}>Level {selectedNode.referralLevel} Generation</span>
                  )}
                </div>
              </div>

              {/* Volume & Package Grid */}
              <div className={styles.modalGrid}>
                <div className={styles.gridItem}>
                  <small>Left Volume</small>
                  <strong>
                    {selectedNode.leftVolume?.toLocaleString() || 0} KBP
                  </strong>
                </div>
                <div className={styles.gridItem}>
                  <small>Right Volume</small>
                  <strong>
                    {selectedNode.rightVolume?.toLocaleString() || 0} KBP
                  </strong>
                </div>
                <div className={styles.gridItem}>
                  <small>Pairs Matched</small>
                  <strong>{selectedNode.pairCount || 0}</strong>
                </div>
                <div className={styles.gridItem}>
                  <small>Package</small>
                  <strong className={styles.packageHighlight}>
                    {selectedNode.packageName || "Starter Package"}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BinaryTreePage;