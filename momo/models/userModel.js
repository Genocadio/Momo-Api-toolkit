const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
    serviceName: { type: String, required: true },  // The name of the service
    apiKey: { type: String, required: true },  // The unique API key for this service
});

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String },  // Optional name field
    phoneNumber: { type: String, required: true },  // Added phone number field
    userType: { type: String, default: 'customer' },
    apiKeys: { type: [apiKeySchema], default: [] },  // Array to store API keys for each service
});

// Ensure the schema is transformed when converting to JSON
userSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
        delete returnedObject.__v;
        delete returnedObject.password; // Do not reveal the hashed password
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
