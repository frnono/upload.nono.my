let uploadCount = 0;
let completedUploads = 0;

function formatSizeUnits(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(date) {
    return date.toLocaleTimeString() + ' ' + date.toLocaleDateString();
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

    progressBar.style.width = percentComplete + '%';
    progressText.textContent = percentComplete + '%';

    const timeElapsed = (Date.now() - startTime) / 1000;
    const uploadSpeed = (loaded / timeElapsed) / (1024 * 1024);
    const uploadedSize = formatSizeUnits(loaded);
    const totalSize = formatSizeUnits(total);

    const [uploadedNum, uploadedUnit] = uploadedSize.split(' ');
    const [totalNum, totalUnit] = totalSize.split(' ');

    statsElement.textContent = `${parseFloat(uploadedNum).toFixed(2)} ${uploadedUnit} / ${parseFloat(totalNum).toFixed(2)} ${totalUnit} at ${uploadSpeed.toFixed(2)} MB/s`;
}

function toggleBulkDeleteButton() {
    const checkedFiles = document.querySelectorAll('.file-checkbox:checked');
    const bulkDeleteButton = document.getElementById('bulkDelete');
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
        const fileListElement = document.getElementById('fileList');
        const uploadedFilesHeading = document.getElementById('uploadedFilesHeading');
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
                <li>
                    <input type="checkbox" class="file-checkbox" data-filename="${file.uuid}">
                    <label class="checkbox-label" for="${file.uuid}">
                        <a href="${fileUrl}" download="${newName}">${newName}</a>
                    </label>
                    <span style="margin-left: 10px;">(${fileSize})</span>
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
    document.querySelectorAll('.copy-link-icon').forEach(icon => {
        icon.addEventListener('click', () => {
            const link = icon.getAttribute('data-link');
            navigator.clipboard.writeText(window.location.origin + link)
                .then(() => alert('Successfully copied!'))
                .catch(err => console.error('Error copying link:', err));
        });
    });
}

function addDeleteHandlers() {
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const filename = e.target.dataset.filename;
            try {
                const response = await fetch(`/delete/${filename}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    await fetchFileList();
                    alert('File deleted successfully');
                } else {
                    alert('Error deleting file');
                }
            } catch (error) {
                console.error('Error deleting file:', error);
                alert('Error deleting file');
            }
        });
    });
}

document.getElementById('bulkDelete').addEventListener('click', async () => {
    const checkedFiles = document.querySelectorAll('.file-checkbox:checked');
    const filenames = Array.from(checkedFiles).map(checkbox => checkbox.dataset.filename);

    const promises = filenames.map(async (filename) => {
        try {
            const response = await fetch(`/delete/${filename}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Delete failed');
        } catch (error) {
            console.error(`Error deleting file ${filename}:`, error);
        }
    });

    await Promise.all(promises);
    fetchFileList();
});

document.getElementById('clearHistory').addEventListener('click', () => {
    document.getElementById('uploadProgress').innerHTML = '';
    document.getElementById('clearHistory').style.display = 'none';
});

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const fileInput = document.getElementById('fileInput');
    const files = fileInput.files;

    if (files.length === 0) {
        alert("Please select at least one file.");
        return;
    }

    uploadCount = files.length;
    completedUploads = 0;

    document.getElementById('clearHistory').style.display = 'block';

    for (const file of files) {
        const progressElement = createProgressElement(file);
        document.getElementById('uploadProgress').appendChild(progressElement);

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
                uploadTime.textContent = `Completed: ${formatTime(new Date())}`;
                progressElement.appendChild(uploadTime);
            } else {
                progressElement.style.backgroundColor = '#4a1a1a';
                progressElement.querySelector('.upload-stats').textContent = 'Error uploading file';
            }

            if (completedUploads === uploadCount) {
                await new Promise(resolve => setTimeout(resolve, 100));
                await fetchFileList();
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

    fileInput.value = '';
});

window.onload = fetchFileList;