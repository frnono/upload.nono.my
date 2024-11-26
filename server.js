const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const app = express();
const port = 3000;

// Directory for uploads
const uploadPath = path.join(__dirname, 'uploads');
const mappingsFilePath = path.join(__dirname, 'file-mappings.json');

// Functions for JSON manipulation
function readFileMappings() {
    if (!fs.existsSync(mappingsFilePath)) {
        return {};
    }
    return JSON.parse(fs.readFileSync(mappingsFilePath));
}

function writeFileMappings(mappings) {
    fs.writeFileSync(mappingsFilePath, JSON.stringify(mappings, null, 2));
}

// Serve static files
app.use(express.static('public'));
app.use('/uploads', express.static(uploadPath));

// Set up multer for file upload with UUID filenames
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname);
        const randomName = uuidv4() + extension;
        saveFileMapping(randomName, file.originalname);
        cb(null, randomName);
    }
});

const upload = multer({ storage: storage });

// Saves file names for each uuid
function saveFileMapping(randomName, originalName) {
    let mappings = readFileMappings();
    mappings[randomName] = originalName;
    writeFileMappings(mappings);
}

// Lookup file name from uuid without extension
function lookupOriginalName(randomName) {
    const mappings = readFileMappings();
    return mappings[randomName];
}

// Handle file upload
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    res.status(200).json({ message: 'Upload successful', fileName: req.file.filename });
});

// Handle file download with original name
app.get('/d/:uuid', (req, res) => {
    const filenameWithExt = req.params.uuid;
    const filePath = path.join(uploadPath, filenameWithExt);
    const originalName = lookupOriginalName(filenameWithExt);

    if (fs.existsSync(filePath) && originalName) {
        res.download(filePath, originalName);
    } else {
        res.status(404).send('File not found');
    }
});

// Return list of files with UUID and original names
app.get('/files', (req, res) => {
    fs.readdir(uploadPath, (err, files) => {
        if (err) {
            return res.status(500).send('Unable to scan files');
        }

        const fileDetails = files.map(file => {
            const filePath = path.join(uploadPath, file);
            const stats = fs.statSync(filePath);
            const originalName = lookupOriginalName(file);
            return {
                name: originalName,
                uuid: file,
                size: stats.size,
                modifiedTime: stats.mtimeMs
            };
        });

        res.json(fileDetails);
    });
});

// Handle file deletion
app.delete('/delete/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadPath, filename);
    const mappings = readFileMappings();

    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, err => {
            if (err) {
                return res.status(500).send('Error deleting file');
            }
            delete mappings[filename]; // Remove entry from mappings
            writeFileMappings(mappings); // Update mappings file
            res.send('File deleted successfully');
        });
    } else {
        res.status(404).send('File not found');
    }
});

// Delete function to clean up old files
/*
function deleteOldFiles() {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

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

// Schedule deletion of old files
setInterval(deleteOldFiles, 60 * 60 * 1000);
*/

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});