const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      status: 'fail',
      message: 'Bạn không có quyền thực hiện hành động này',
    });
  }
};

const isTutor = (req, res, next) => {
  if (req.user && req.user.role === 'tutor') {
    next();
  } else {
    return res.status(403).json({
      status: 'fail',
      message: 'Chỉ gia sư mới có quyền thực hiện hành động này',
    });
  }
};

const isAdminOrTutor = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'tutor')) {
    next();
  } else {
    return res.status(403).json({
      status: 'fail',
      message: 'Bạn không có quyền thực hiện hành động này',
    });
  }
};

const isOwnerOrAdmin = async (req, res, next) => {
  try {
    const userId = req.params.id || req.body.userId;
    if (req.user.role === 'admin' || req.user._id.toString() === userId.toString()) {
      next();
    } else {
      return res.status(403).json({
        status: 'fail',
        message: 'Bạn không có quyền thực hiện hành động này',
      });
    }
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Lỗi xác thực quyền: ' + error.message,
    });
  }
};

module.exports = {
  isAdmin,
  isTutor,
  isAdminOrTutor,
  isOwnerOrAdmin,
};