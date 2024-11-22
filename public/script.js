let uploadCount = 0;
let completedUploads = 0;

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const bulkDeleteButton = document.getElementById('bulkDelete');
const uploadForm = document.getElementById('uploadForm');
const uploadProgress = document.getElementById('uploadProgress');
const clearHistoryButton = document.getElementById('clearHistory');
const fileListElement = document.getElementById('fileList');
const uploadedFilesHeading = document.getElementById('uploadedFilesHeading');

function formatSizeUnits(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function createProgressElement(file) {
    const div = document.createElement('div');
    div.className = 'upload-item';
    div.innerHTML = `
        <div class="filename">${file.name}</div>
        <div class="upload-stats"></div>
        <div class="progress-container">
            <div class="progress-bar"></div>
            <div class="progress-text">0%</div>
        </div>
        <div class="upload-time"></div>
    `;
    return div;
}

function updateProgress(progressElement, loaded, total, startTime) {
    const percentComplete = ((loaded / total) * 100).toFixed(0);
    const progressBar = progressElement.querySelector('.progress-bar');
    const progressText = progressElement.querySelector('.progress-text');
    const statsElement = progressElement.querySelector('.upload-stats');

    progressBar.style.width = `${percentComplete}%`;
    progressText.textContent = `${percentComplete}%`;

    const timeElapsed = (Date.now() - startTime) / 1000;
    const uploadSpeed = (loaded / timeElapsed) / (1024 * 1024);
    const uploadedSize = formatSizeUnits(loaded);
    const totalSize = formatSizeUnits(total);

    statsElement.textContent = `${uploadedSize} / ${totalSize} at ${uploadSpeed.toFixed(2)} MB/s`;
}

function toggleBulkDeleteButton() {
    const checkedFiles = document.querySelectorAll('.file-checkbox:checked');
    bulkDeleteButton.style.display = checkedFiles.length > 0 ? 'block' : 'none';
}

function addCheckboxListeners() {
    document.querySelectorAll('.file-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', toggleBulkDeleteButton);
    });
}

async function fetchFileList() {
    try {
        const response = await fetch('/files');
        const files = await response.json();
        
        files.sort((a, b) => b.modifiedTime - a.modifiedTime);

        const existingFiles = new Map();
        const fileListHtml = files.map(file => {
            let newName = file.name;
            let nameCounter = existingFiles.get(newName) || 0;

            while (existingFiles.has(newName)) {
                nameCounter++;
                const nameParts = newName.match(/(.*?)(?:\((\d+)\))?\.(.*)/);
                const baseName = nameParts[1];
                const extension = nameParts[3];
                newName = `${baseName}(${nameCounter}).${extension}`;
            }

            existingFiles.set(newName, nameCounter);
            
            const fileUrl = `/download/${file.uuid}`;
            const fileSize = formatSizeUnits(file.size);
            return `
                <li class="file-list-item">
                    <input type="checkbox" class="file-checkbox" data-filename="${file.uuid}">
                    <label class="checkbox-label" for="${file.uuid}">
                        <a href="${fileUrl}" download="${newName}">${newName}</a>
                    </label>
                    <span class="file-size">(${fileSize})</span>
                    <span class="copy-link-icon" data-link="${fileUrl}">📋</span>
                </li>
            `;
        }).join('');

        fileListElement.innerHTML = fileListHtml;
        uploadedFilesHeading.style.display = files.length === 0 ? 'none' : 'block';

        addCheckboxListeners();
        addCopyLinkHandlers();
        toggleBulkDeleteButton();
    } catch (error) {
        console.error('Error fetching file list:', error);
    }
}

function addCopyLinkHandlers() {
    document.querySelectorAll('.file-list-item').forEach(li => {
        li.addEventListener('click', async event => {
            const copyLinkIcon = li.querySelector('.copy-link-icon');
            const link = copyLinkIcon ? copyLinkIcon.getAttribute('data-link') : null;

            if (
                link && 
                !event.target.matches('input[type="checkbox"]') && 
                !event.target.closest('a')
            ) {
                try {
                    await navigator.clipboard.writeText(window.location.origin + link);
                    alert('Link copied to clipboard!');
                } catch (err) {
                    console.error('Error copying link:', err);
                    alert('Failed to copy link');
                }
            }
        });
    });
}
bulkDeleteButton.addEventListener('click', async () => {
    const checkedFiles = document.querySelectorAll('.file-checkbox:checked');
    const filenames = Array.from(checkedFiles).map(checkbox => checkbox.dataset.filename);

    try {
        const promises = filenames.map(filename =>
            fetch(`/delete/${filename}`, { method: 'DELETE' }).catch(err => {
                console.error(`Error deleting file ${filename}:`, err);
            })
        );

        await Promise.all(promises);
        fetchFileList();
        alert('Selected files deleted successfully');
    } catch (error) {
        console.error('Error deleting files:', error);
        alert('Error deleting some files');
    }
});

clearHistoryButton.addEventListener('click', () => {
    uploadProgress.innerHTML = '';
    clearHistoryButton.style.display = 'none';
});

// Open file dialog when clicking the drop zone
dropZone.addEventListener('click', () => {
    fileInput.click();
});

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Handle drag enter/leave visual feedback
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
});

function highlight(e) {
    dropZone.classList.add('drag-over');
}

function unhighlight(e) {
    dropZone.classList.remove('drag-over');
}

// Handle dropped files
dropZone.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

// Handle files selected through file dialog
fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    if (files.length === 0) {
        alert("Please select at least one file.");
        return;
    }

    uploadCount = files.length;
    completedUploads = 0;
    clearHistoryButton.style.display = 'block';

    for (const file of files) {
        const progressElement = createProgressElement(file);
        uploadProgress.appendChild(progressElement);

        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload', true);

        const startTime = Date.now();

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                updateProgress(progressElement, event.loaded, event.total, startTime);
            }
        };

        xhr.onload = async () => {
            completedUploads++;

            if (xhr.status === 200) {
                progressElement.style.backgroundColor = '#3f2f52';
                const uploadTime = document.createElement('div');
                uploadTime.className = 'upload-time';
                uploadTime.textContent = `Finished at ${formatTime(new Date())}`;
                progressElement.appendChild(uploadTime);
            } else {
                progressElement.style.backgroundColor = '#4a1a1a';
                progressElement.querySelector('.upload-stats').textContent = 'Error uploading file';
            }

            if (completedUploads === uploadCount) {
                await new Promise(resolve => setTimeout(resolve, 100));
                fetchFileList();
            }
        };

        xhr.onerror = () => {
            completedUploads++;
            progressElement.style.backgroundColor = '#4a1a1a';
            progressElement.querySelector('.upload-stats').textContent = 'Error uploading file';

            if (completedUploads === uploadCount) {
                fetchFileList();
            }
        };

        xhr.send(formData);
    }

    fileInput.value = ''; // Reset file input
}

window.onload = fetchFileList;