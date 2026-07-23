const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const fieldRoutes = require('./routes/fieldRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static assets with explicit MIME types
app.use(express.static(path.join(__dirname, '.'), {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Mount API Routes
app.use('/api', fieldRoutes);

// Fallback static serve for Frontend
app.get('*', (req, res) => {
  if (req.path.includes('.')) {
    return res.sendFile(path.join(__dirname, req.path));
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start MERN Express Server
app.listen(PORT, () => {
  console.log('================================================--');
  console.log(`🚀 Terriva MERN Stack Platform Running on http://localhost:${PORT}`);
  console.log('   MongoDB + Express.js + Node.js + AI Models Active');
  console.log('================================================--');
});
