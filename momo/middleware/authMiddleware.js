const User = require('../models/userModel'); // Import the User model

const authMiddleware = async (req, res, next) => {
    try {
        // Get the API key from headers
        const apiKey = req.header('x-api-key'); // Use x-api-key header for API key
        console.log('API Key:', apiKey);

        if (!apiKey) {
            return res.status(401).json({ message: 'Access denied. No API key provided.' });
        }

        // Find the user associated with the API key
        const user = await User.findOne({ 'apiKeys.apiKey': apiKey });

        if (!user) {
            return res.status(401).json({ message: 'User not found for the provided API key.' });
        }

        // Find the specific API key object to get the associated service
        const apiKeyObject = user.apiKeys.find(key => key.apiKey === apiKey);

        if (!apiKeyObject) {
            return res.status(401).json({ message: 'API key not associated with user.' });
        }

        // Attach user and service to the request object
        console.log('User:', user,  'Service:', apiKeyObject)
        req.user = user;
        req.service = apiKeyObject.serviceName; // Store the service name in the request
        console.log('User:', req.user, '\n\nService:', req.service);
        // Proceed to the next middleware or route handler
        next();

    } catch (error) {
        return res.status(500).json({ message: 'Internal server error', error });
    }
};

module.exports = authMiddleware;
