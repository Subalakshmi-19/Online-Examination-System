// backend/server.js
const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db'); // your db.js file

// Load .env variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware to parse JSON
app.use(express.json());

// Example API route to test MongoDB connection
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Serve frontend if needed (optional)
// app.use(express.static(path.join(__dirname, '../client')));

// Catch-all route for undefined endpoints
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT} & MongoDB connected`)
);
