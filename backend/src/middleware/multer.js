import multer from "multer";
import path from "path";
import fs from "fs";

const IMG_DIR = path.join(process.cwd(), "uploads", "images");

if (!fs.existsSync(IMG_DIR)) {
    fs.mkdirSync(IMG_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, IMG_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const filename =
            "img-" + Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
        return cb(new Error("Only JPG, PNG or WebP images are allowed"));
    }
    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

export const deleteUploadedFile = (filePath) => {
    try {
        if (!filePath) return;

        const fullPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(process.cwd(), filePath.replace(/^\//, ""));

        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    } catch (err) {
        console.error("deleteUploadedFile error:", err);
    }
};


export default upload;