const Favorite = require('../models/favorite.model');
const Tutor = require('../models/tutor.model');

// Add a tutor to favorites
const addFavorite = async (req, res) => {
    try {
        const {tutorId} = req.params;
        const studentId = req.user._id; // Assuming user is authenticated and attached to req

        // Check if tutor exists
        const tutorExists = await Tutor.exists({_id: tutorId});
        if (!tutorExists) {
            return res.status(404).json({
                status: 'fail',
                message: 'Không tìm thấy gia sư'
            });
        }

        // Check if already favorited
        const existingFavorite = await Favorite.findOne({studentId, tutorId});
        if (existingFavorite) {
            return res.status(400).json({
                status: 'fail',
                message: 'Gia sư này đã nằm trong danh sách yêu thích'
            });
        }

        // Create new favorite
        const favorite = await Favorite.create({
            studentId,
            tutorId
        });

        res.status(201).json({
            status: 'success',
            data: favorite
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Có lỗi xảy ra khi thêm gia sư vào danh sách yêu thích: ' + error.message
        });
    }
};

// Remove a tutor from favorites
const removeFavorite = async (req, res) => {
    try {
        const {tutorId} = req.params;
        const studentId = req.user._id; // Assuming user is authenticated and attached to req

        const favorite = await Favorite.findOneAndDelete({studentId, tutorId});

        if (!favorite) {
            return res.status(404).json({
                status: 'fail',
                message: 'Không tìm thấy gia sư trong danh sách yêu thích'
            });
        }

        res.json({
            status: 'success',
            message: 'Đã xóa gia sư khỏi danh sách yêu thích'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Có lỗi xảy ra khi xóa gia sư khỏi danh sách yêu thích: ' + error.message
        });
    }
};

// Get all favorite tutors for a user
const getFavorites = async (req, res) => {
    try {
        const studentId = req.user._id; // Assuming user is authenticated and attached to req

        const favorites = await Favorite.find({studentId})
            .populate({
                path: 'tutorId',
                populate: {path: 'studentId', select: 'name avatar phone email'}
            });

        res.json({
            status: 'success',
            data: favorites
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Có lỗi xảy ra khi lấy danh sách gia sư yêu thích: ' + error.message
        });
    }
};

// Check if a tutor is in user's favorites
const checkFavorite = async (req, res) => {
    try {
        const {tutorId} = req.params;
        const studentId = req.user._id; // Assuming user is authenticated and attached to req

        const favorite = await Favorite.findOne({studentId, tutorId});

        res.json({
            status: 'success',
            data: {
                isFavorite: !!favorite
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Có lỗi xảy ra khi kiểm tra gia sư yêu thích: ' + error.message
        });
    }
};

module.exports = {
    addFavorite,
    removeFavorite,
    getFavorites,
    checkFavorite
};
