const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// Directory for uploads
const uploadPath = path.join(__dirname, 'uploads');

// Serve static files
app.use(express.static('public'));
app.use('/uploads', express.static(uploadPath));

// Set up multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const originalName = file.originalname;
        const modifiedName = originalName.replace(/\s+/g, '_'); // Replace spaces with underscores
        cb(null, Date.now() + '-' + modifiedName);
    }
});

const upload = multer({ storage: storage });

// Handle file upload
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    res.status(200).json({ message: 'Upload successful', fileName: req.file.filename });
});

// Handle file download
app.get('/download/:filename', (req, res) => {
    const fileName = req.params.filename;
    const filePath = path.join(uploadPath, fileName);

    if (fs.existsSync(filePath)) {
        res.download(filePath, fileName);
    } else {
        res.status(404).send('File not found');
    }
});

// Returns file size
app.get('/files', (req, res) => {
    fs.readdir(uploadPath, (err, files) => {
        if (err) {
            return res.status(500).send('Unable to scan files');
        }

        const fileDetails = files.map(file => {
            const filePath = path.join(uploadPath, file);
            const stats = fs.statSync(filePath);
            return {
                name: file,
                size: stats.size // file size in bytes
            };
        });

        res.json(fileDetails);
    });
});

// Handle file deletion
app.delete('/delete/:filename', (req, res) => {
    const fileName = req.params.filename;
    const filePath = path.join(uploadPath, fileName);

    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, err => {
            if (err) {
                return res.status(500).send('Error deleting file');
            }
            res.send('File deleted successfully');
        });
    } else {
        res.status(404).send('File not found');
    }
});


// Function to delete files older than 24 hours
function deleteOldFiles() {
    const now = Date.now();

    fs.readdir(uploadPath, (err, files) => {
        if (err) {
            console.error('Unable to scan directory:', err);
            return;
        }

        files.forEach(file => {
            const filePath = path.join(uploadPath, file);
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    console.error(`Error getting stats for file ${file}:`, err);
                    return;
                }

                const fileAge = now - stats.mtimeMs;
                const oneWeek = 7 * 24 * 60 * 60 * 1000; // One day in milliseconds

                if (fileAge > oneWeek) {
                    fs.unlink(filePath, err => {
                        if (err) {
                            console.error(`Error deleting file ${file}:`, err);
                        } else {
                            console.log(`Deleted old file: ${file}`);
                        }
                    });
                }
            });
        });
    });
}


// Check and delete old files every hour
setInterval(deleteOldFiles, 60 * 60 * 1000);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});