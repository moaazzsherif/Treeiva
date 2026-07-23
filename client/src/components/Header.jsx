import React from 'react';

export default function Header({ user, onTabSwitch }) {
  return (
    <header className="row-header glass" style={{ padding: '15px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--primary-light, #8B9B49)' }}>
          🌱 Terriva MERN Agronomy Platform
        </h2>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)' }}>
          Powered by MongoDB, Express.js, React.js, Node.js & Machine Learning
        </span>
      </div>
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
        <button className="primary-btn" onClick={() => onTabSwitch('recommendations')}>
          <i className="fa-solid fa-wand-magic-sparkles"></i> AI Prescription Engine
        </button>
      </div>
    </header>
  );
}
