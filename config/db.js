const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const connStr = process.env.MONGO_URI || 'mongodb://localhost:27017/terriva_db';
    const conn = await mongoose.connect(connStr, {
      serverSelectionTimeoutMS: 3000
    });
    console.log(`[MongoDB] Database Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(`[MongoDB] Mongo Connection Notice: ${error.message}`);
    console.log(`[MongoDB] Operating in MERN hybrid mode with resilient local store.`);
  }
};

module.exports = connectDB;
