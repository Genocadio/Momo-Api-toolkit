const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User', // Assuming you have a User model
    },
    transactionType: {
        type: String,
        required: true,
        enum: ['payment', 'withdrawal'], // Only these types are allowed
    },
    amount: {
        type: Number,
        required: true,
    },
    phoneNumber: {
        type: String,
    
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'completed', 'failed'], // Status of the transaction
    },
    createdAt: {
        type: Date,
        default: Date.now, // Automatically sets the date when the transaction is created
    },
    updatedAt: {
        type: Date,
        default: Date.now, // Automatically sets the date when the transaction is updated
    },
});

// Middleware to update the updatedAt field before saving
transactionSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
