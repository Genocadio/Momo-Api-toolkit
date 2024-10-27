const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const cors = require('cors');
const authMiddleware = require('./middleware/authMiddleware'); // Import the middleware

// Initialize the app
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB connection
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017';
mongoose
    .connect(mongoURI)
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
    });

// Import routers
const paymentRouter = require('./controllers/paymentController');  // Payment router
const authRouter = require('./controllers/authController');        // Authentication router

// Use routers
app.use('/api/payments', authMiddleware, paymentRouter);  // Payment routes
app.use('/api/auth', authRouter);         // Authentication routes

// Example route for server check
app.get('/', (req, res) => {
    res.send('Server is running');
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
