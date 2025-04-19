const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    tutorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tutor',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index to ensure a user can only favorite a tutor once
favoriteSchema.index({studentId: 1, tutorId: 1}, {unique: true});

const Favorite = mongoose.model('Favorite', favoriteSchema);

module.exports = Favorite;
