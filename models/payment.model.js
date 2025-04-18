const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        enum: ['deposit', 'withdrawal', 'session_payment', 'session_refund', 'tutor_earning'],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
    paymentIntentId: {
        type: String,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Payment', paymentSchema);