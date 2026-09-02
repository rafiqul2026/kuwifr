// client/src/pages/public/BlogPage.jsx
import React from 'react';
import styles from './BlogPage.module.css';

const BLOG_POSTS = [
  {
    id: 1,
    title: 'The Science of Alkaline Water: Benefits for Daily Metabolism',
    category: 'Alkaline Tech',
    date: 'August 24, 2026',
    readTime: '4 min read',
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop&q=80',
    summary: 'Discover how ionized antioxidant water helps maintain bodily pH balance, neutralizes free radicals, and supports faster post-workout hydration.'
  },
  {
    id: 2,
    title: 'Himalayan Shilajit 99: Traditional Wisdom Meets Modern Quality',
    category: 'Wellness & Health',
    date: 'August 18, 2026',
    readTime: '6 min read',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
    summary: 'A deep dive into fulvic acid, natural trace minerals, and how authentic resin harvesting improves daily energy and mental clarity.'
  },
  {
    id: 3,
    title: 'Eco-Friendly Commutes: Why Smart Electric Mobility is the Future',
    category: 'EV Mobility',
    date: 'August 10, 2026',
    readTime: '5 min read',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600&auto=format&fit=crop&q=80',
    summary: 'How electric two-wheelers are saving urban commuters fuel costs while cutting down emissions for a cleaner tomorrow.'
  }
];

const BlogPage = () => {
  return (
    <div className={styles.blogPage}>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.badge}>Insights & Lifestyle</span>
          <h1 className={styles.title}>KUWIFR Wellness & Lifestyle Journal</h1>
          <p className={styles.subtitle}>Articles, wellness guides, and technology reviews from verified health & mobility experts.</p>
        </div>

        <div className={styles.grid}>
          {BLOG_POSTS.map((post) => (
            <article key={post.id} className={styles.card}>
              <div className={styles.imageBox}>
                <span className={styles.categoryBadge}>{post.category}</span>
                <img src={post.image} alt={post.title} loading="lazy" />
              </div>
              <div className={styles.cardBody}>
                <div className={styles.meta}>
                  <span>{post.date}</span> • <span>{post.readTime}</span>
                </div>
                <h2 className={styles.cardTitle}>{post.title}</h2>
                <p className={styles.summary}>{post.summary}</p>
                <button className={styles.readMoreBtn}>Read Article →</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BlogPage;