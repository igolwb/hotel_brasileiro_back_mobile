import multer from 'multer';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Folder to store images
  },
  filename: function (req, file, cb) {
    // Unique filename: clienteID + original extension
    const ext = file.originalname.split('.').pop();
    cb(null, `profile_${req.params.id}.${ext}`);
  }
});
const upload = multer({ storage });

export default upload;