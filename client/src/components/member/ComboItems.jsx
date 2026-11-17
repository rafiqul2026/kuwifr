// client/src/components/member/ComboItems.jsx
//
// Lists every product in a package combo / product group with its own
// photo, name, quantity and KSP — used on Buy Package and Upgrade Package
// (cards and the review step) so members can see exactly what the combo
// contains instead of a single photo and a run-on line of names.
import React from 'react';
import { cdnImage, cdnSrcSet } from '../../utils/imageUrl';
import styles from './ComboItems.module.css';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const ComboItems = ({ items = [], savings = 0, size = 'sm' }) => {
  if (!items.length) return null;
  const thumb = size === 'lg' ? 48 : 36;
  return (
    <div className={`${styles.combo} ${size === 'lg' ? styles.lg : ''}`}>
      <ul className={styles.list} aria-label="Products in this combo">
        {items.map((it) => (
          <li key={it.id} className={styles.item}>
            <span className={styles.thumb} style={{ width: thumb, height: thumb }}>
              {it.image ? (
                <img
                  src={cdnImage(it.image, thumb)}
                  srcSet={cdnSrcSet(it.image, thumb)}
                  alt=""
                  width={thumb}
                  height={thumb}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span aria-hidden="true">📦</span>
              )}
            </span>
            <span className={styles.text}>
              <span className={styles.name}>{it.name}</span>
              <span className={styles.meta}>
                {it.quantity > 1 && <strong className={styles.qty}>× {it.quantity}</strong>}
                {it.ksp ? <span>KSP {inr(it.ksp)}{it.quantity > 1 ? ' each' : ''}</span> : null}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {savings > 0 && <span className={styles.savings}>Combo saves {inr(savings)}</span>}
    </div>
  );
};

export default ComboItems;
