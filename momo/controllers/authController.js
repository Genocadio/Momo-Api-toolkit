const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');  // For generating API key
const User = require('../models/userModel');  // Import the User model

const router = express.Router();

// Environment settings for testing
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const ENV = process.env.NODE_ENV || 'testing';

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization']; // Get the authorization header

    // Check if the authHeader is present and starts with 'Bearer '
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access denied, no token provided' });
    }

    // Extract the token from the authorization header
    const token = authHeader.split(' ')[1]; // Split the header to get the token part

    try {
        const decoded = jwt.verify(token, JWT_SECRET); // Verify the token
        req.user = decoded;  // Attach the user data to the request object
        next(); // Call the next middleware or route handler
    } catch (err) {
        res.status(400).json({ message: 'Invalid token' }); // Token verification failed
    }
};

// User registration
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, phoneNumber } = req.body;

        // Validate required fields
        if (!email || !password || !phoneNumber) {
            return res.status(400).json({ error: 'Email, password, and phone number are required' });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email is already in use' });
        }

        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create a new user instance (userType defaults to 'customer')
        const newUser = new User({
            email,
            password: hashedPassword,  // Store the hashed password
            name,  // Optional field
            phoneNumber,
            // userType will default to 'customer'
            // allowedRoutes will default to ['MOMO']
        });

        // Save the user to the database
        const savedUser = await newUser.save();

        // Send a response back (excluding password)
        res.status(201).json(savedUser.toJSON());
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'An error occurred while registering the user' });
    }
});
// User login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find the user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Compare the provided password with the hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate a JWT token for the user
        const token = jwt.sign({ userId: user._id, userType: user.userType }, JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({
            token,
            user: {
                id: user._id,
                email: user.email,
                userType: user.userType,
                allowedRoutes: user.allowedRoutes,
            },
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
});

// Generate API key
router.post('/generate-api-key', authenticateToken, async (req, res) => {
    const { serviceName } = req.body;

    if (!serviceName) {
        return res.status(400).json({ message: 'Service name is required' });
    }

    try {
        // Find the user by their ID (from the token)
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if an API key already exists for this service
        const existingApiKey = user.apiKeys.find(key => key.serviceName === serviceName);
        if (existingApiKey) {
            return res.status(400).json({ message: `API key for ${serviceName} already exists` });
        }

        // Generate a unique API key for this service
        const apiKey = crypto.randomBytes(32).toString('hex');

        // Add the new API key for the service
        user.apiKeys.push({ serviceName, apiKey });
        await user.save();

        res.status(200).json({ message: 'API key generated successfully', apiKey });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
});

module.exports = router;
