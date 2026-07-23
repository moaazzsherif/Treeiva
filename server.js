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
app.use(express.static(path.join(__dirname, '.')));

// Mount API Routes
app.use('/api', fieldRoutes);

// Fallback static serve for Frontend SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start MERN Express Server
app.listen(PORT, () => {
  console.log('================================================--');
  console.log(`🚀 Terriva MERN Stack Platform Running on http://localhost:${PORT}`);
  console.log('   MongoDB + Express.js + Node.js + AI Models Active');
  console.log('================================================--');
});
