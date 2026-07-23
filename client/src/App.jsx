import React, { useState, useEffect } from 'react';

export default function App() {
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    fetch('/api/fields')
      .then(res => res.json())
      .then(data => setFields(data))
      .catch(err => console.error(err));
  }, []);

  const runAnalysis = (fieldId) => {
    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field_id: fieldId })
    })
      .then(res => res.json())
      .then(data => setAnalysis(data))
      .catch(err => console.error(err));
  };

  return (
    <div className="mern-app-container">
      <header className="navbar">
        <h1>🌾 Terriva MERN Agriculture Platform</h1>
      </header>
      <main className="dashboard-content">
        <h2>Active Fields & AI Decision Fusion</h2>
        <div className="fields-grid">
          {fields.map(f => (
            <div key={f.id} className="field-card glass" onClick={() => runAnalysis(f.id)}>
              <h3>{f.name}</h3>
              <p>Crop: {f.crop} | Soil: {f.soil_type}</p>
              <button className="primary-btn">Analyze Soil & Recommendations</button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
