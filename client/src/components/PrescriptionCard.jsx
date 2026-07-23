import React from 'react';

export default function PrescriptionCard({ title, icon, color, fertName, kgFeddan, bagsFeddan, totalBags, reason }) {
  return (
    <div className="glass" style={{ padding: '20px', borderTop: `4px solid ${color}`, borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ color: color, margin: 0 }}>
          <i className={`fa-solid ${icon}`}></i> {title}
        </h4>
      </div>
      <p style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px', color: '#f8fafc' }}>
        {fertName}
      </p>
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '10px', color: '#cbd5e1' }}>
        <div>• الجرعة للفدان: <strong>{kgFeddan} كجم/فدان</strong> (حوالي <strong>{bagsFeddan} شكارة</strong>)</div>
        <div>• إجمالي الحقل: <strong>{totalBags} شكارة</strong></div>
      </div>
      <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
        💡 <em>{reason}</em>
      </p>
    </div>
  );
}
