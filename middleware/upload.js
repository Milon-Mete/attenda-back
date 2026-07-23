const { upload } = require('../config/cloudinary');

/**
 * Middleware for handling selfie image uploads via multipart/form-data.
 * The field name expected is 'selfie'.
 * On success, req.file will contain the uploaded file info from Cloudinary.
 */
const uploadSelfie = (req, res, next) => {
  const singleUpload = upload.single('selfie');

  singleUpload(req, res, (err) => {
    if (err) {
      // Handle multer-specific errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 5MB.',
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field. Use field name "selfie".',
        });
      }
      // Handle our file filter errors
      if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
      // Cloudinary errors
      if (err.http_code && err.http_code >= 400) {
        return res.status(502).json({
          success: false,
          message: 'Image upload service error. Please try again.',
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Upload failed.',
      });
    }
    next();
  });
};

module.exports = { uploadSelfie };
