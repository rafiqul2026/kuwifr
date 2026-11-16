// client/src/components/public/FaqAccordion.jsx
//
// Accessible accordion (WAI-ARIA disclosure pattern): each question is a
// real <button> with aria-expanded/aria-controls; answers stay in the DOM
// (hidden) so search engines can read them. Arrow Up/Down, Home and End
// move between questions.
import React, { useId, useRef, useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import styles from './FaqAccordion.module.css';

const FaqAccordion = ({ items = [], defaultOpen = 0 }) => {
  const uid = useId();
  const [open, setOpen] = useState(defaultOpen);
  const buttons = useRef([]);

  const onKeyDown = (e, idx) => {
    const last = items.length - 1;
    let next = null;
    if (e.key === 'ArrowDown') next = idx === last ? 0 : idx + 1;
    else if (e.key === 'ArrowUp') next = idx === 0 ? last : idx - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next !== null) {
      e.preventDefault();
      buttons.current[next]?.focus();
    }
  };

  return (
    <div className={styles.list}>
      {items.map((item, idx) => {
        const isOpen = open === idx;
        const btnId = `${uid}-q${idx}`;
        const panelId = `${uid}-a${idx}`;
        return (
          <div key={item.q} className={`${styles.item} ${isOpen ? styles.itemOpen : ''}`}>
            <h3 className={styles.heading}>
              <button
                ref={(el) => { buttons.current[idx] = el; }}
                id={btnId}
                type="button"
                className={styles.question}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : idx)}
                onKeyDown={(e) => onKeyDown(e, idx)}
              >
                <span>{item.q}</span>
                <FiPlus className={styles.icon} aria-hidden="true" />
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={btnId} className={styles.panel} hidden={!isOpen}>
              <p>{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FaqAccordion;
