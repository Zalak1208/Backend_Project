import multer from "multer";

// this whole function saves the file on local server and returns localFilePath required for uploading on cloudinary
const storage = multer.diskStorage({
  // we are using disk storage
  destination: function (req, file, cb) {
    // cb stands for call back
    cb(null, "./public/temp");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

export const upload = multer({
  storage,
});
