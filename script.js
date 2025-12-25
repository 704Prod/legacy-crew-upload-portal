// REPLACE THIS WITH YOUR ACTUAL AZURE FUNCTION URL
const AZURE_FUNCTION_URL = 'https://legacy-crew-upload-v2-e8h4akc0brdsh5hd.westcentralus-01.azurewebsites.net/api/fileupload';

// Show form fields when service is selected
document.addEventListener('DOMContentLoaded', function() {
  const serviceRadios = document.querySelectorAll('input[name="serviceType"]');
  const formFields = document.getElementById('formFields');
  
  serviceRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      if (this.checked) {
        formFields.classList.add('show');
        // Smooth scroll to form fields
        setTimeout(() => {
          formFields.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 300);
      }
    });
  });
});

// File upload handling
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const dropZone = document.getElementById('dropZone');
let selectedFiles = [];

// Click to browse
fileInput.addEventListener('change', handleFiles);

// Drag and drop
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  
  const files = Array.from(e.dataTransfer.files);
  handleFiles({ target: { files } });
});

function handleFiles(e) {
  const files = Array.from(e.target.files);
  
  files.forEach(file => {
    // Check file size (500MB limit)
    if (file.size > 500 * 1024 * 1024) {
      alert(`File "${file.name}" exceeds 500MB limit`);
      return;
    }
    
    // Check if already added
    if (!selectedFiles.find(f => f.name === file.name)) {
      selectedFiles.push(file);
    }
  });
  
  displayFiles();
  fileInput.value = ''; // Reset input
}

function displayFiles() {
  fileList.innerHTML = '';
  
  selectedFiles.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
      <span class="file-name">${file.name}</span>
      <span class="file-size">${formatFileSize(file.size)}</span>
      <button type="button" class="remove-file" onclick="removeFile(${index})">Remove</button>
    `;
    fileList.appendChild(fileItem);
  });
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  displayFiles();
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Form submission
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const submitBtn = document.getElementById('submitBtn');
  const progressSection = document.getElementById('progressSection');
  const errorMessage = document.getElementById('errorMessage');
  
  // Hide any previous errors
  errorMessage.style.display = 'none';
  
  // Validate files
  if (selectedFiles.length === 0) {
    showError('Please upload at least one file');
    return;
  }
  
  // Get form data
  const formData = new FormData();
  formData.append('serviceType', document.querySelector('input[name="serviceType"]:checked').value);
  formData.append('artistName', document.getElementById('artistName').value);
  formData.append('email', document.getElementById('email').value);
  formData.append('phone', document.getElementById('phone').value);
  formData.append('songTitle', document.getElementById('songTitle').value);
  formData.append('bpm', document.getElementById('bpm').value || '');
  formData.append('key', document.getElementById('key').value || '');
  formData.append('notes', document.getElementById('notes').value || '');
  
  // Append files
  selectedFiles.forEach(file => {
    formData.append('files', file);
  });
  
  // Disable submit button
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading...';
  
  // Show progress section
  progressSection.style.display = 'block';
  
  try {
    const xhr = new XMLHttpRequest();
    
    // Track upload progress
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        updateProgress(percentComplete, e.loaded, e.total);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        showSuccess();
      } else {
        const response = JSON.parse(xhr.responseText);
        showError(response.error || 'Upload failed. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit to The Core';
        progressSection.style.display = 'none';
      }
    });
    
    xhr.addEventListener('error', () => {
      showError('Network error. Please check your connection and try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit to The Core';
      progressSection.style.display = 'none';
    });
    
    xhr.open('POST', AZURE_FUNCTION_URL);
    xhr.send(formData);
    
  } catch (error) {
    showError('An unexpected error occurred: ' + error.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit to The Core';
    progressSection.style.display = 'none';
  }
});

function updateProgress(percent, loaded, total) {
  const overallProgress = document.getElementById('overallProgress');
  const overallPercentage = document.getElementById('overallPercentage');
  
  overallProgress.style.width = percent + '%';
  overallPercentage.textContent = Math.round(percent) + '%';
}

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showSuccess() {
  const uploadForm = document.getElementById('uploadForm');
  const successMessage = document.getElementById('successMessage');
  const progressSection = document.getElementById('progressSection');
  
  uploadForm.style.display = 'none';
  progressSection.style.display = 'none';
  successMessage.style.display = 'block';
  successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Redirect after 5 seconds
  setTimeout(() => {
    window.location.href = 'thankyou.html';
  }, 5000);
}
