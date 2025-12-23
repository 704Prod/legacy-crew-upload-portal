// YOUR AZURE FUNCTION URL - ALREADY CONFIGURED
const AZURE_FUNCTION_URL = 'https://legacy-crew-upload-func-h2gkhbgnfjdrhzht.westcentralus-01.azurewebsites.net/api/fileupload';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_VOCAL_STEMS = 10;

// Service type switching
document.querySelectorAll('input[name="serviceType"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const masteringFiles = document.getElementById('masteringFiles');
    const mixingFiles = document.getElementById('mixingFiles');
    
    if (e.target.value === 'Initial/Re-Mastering') {
      masteringFiles.style.display = 'block';
      mixingFiles.style.display = 'none';
      clearMixingFiles();
    } else {
      masteringFiles.style.display = 'none';
      mixingFiles.style.display = 'block';
      clearMasteringFiles();
    }
  });
});

// File input handlers
const fileInputs = {
  'finalVersion': { max: 1, info: 'finalVersionInfo' },
  'vocalStems': { max: 10, info: 'vocalStemsInfo' },
  'instrumental': { max: 1, info: 'instrumentalInfo' },
  'reference': { max: 1, info: 'referenceInfo' },
  'masteredFinal': { max: 1, info: 'masteredFinalInfo' }
};

Object.keys(fileInputs).forEach(inputId => {
  const input = document.getElementById(inputId);
  if (!input) return;
  const config = fileInputs[inputId];
  
  input.addEventListener('change', (e) => {
    handleFileSelection(e.target, config);
  });
});

function handleFileSelection(input, config) {
  const files = Array.from(input.files);
  const infoDiv = document.getElementById(config.info);
  
  if (files.length === 0) {
    infoDiv.innerHTML = '<p style="color: #999;">No files selected</p>';
    return;
  }

  if (files.length > config.max) {
    showError(`Maximum ${config.max} file(s) allowed for this field`);
    input.value = '';
    infoDiv.innerHTML = '<p style="color: #999;">No files selected</p>';
    return;
  }

  let totalSize = 0;
  let hasError = false;
  
  files.forEach(file => {
    if (file.size > MAX_FILE_SIZE) {
      showError(`File "${file.name}" exceeds 500MB limit`);
      hasError = true;
    }
    totalSize += file.size;
  });

  if (hasError) {
    input.value = '';
    infoDiv.innerHTML = '<p style="color: #999;">No files selected</p>';
    return;
  }

  const fileItems = files.map(file => `
    <div class="file-item">
      <span class="file-name">${file.name}</span>
      <span class="file-size">${formatFileSize(file.size)}</span>
    </div>
  `).join('');

  infoDiv.innerHTML = fileItems + `
    <p style="margin-top: 10px; color: #6c63ff; font-weight: 600;">
      Total: ${formatFileSize(totalSize)}
    </p>
  `;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function clearMixingFiles() {
  ['vocalStems', 'instrumental', 'reference', 'masteredFinal'].forEach(id => {
    const input = document.getElementById(id);
    const info = document.getElementById(fileInputs[id].info);
    if (input) input.value = '';
    if (info) info.innerHTML = '';
  });
}

function clearMasteringFiles() {
  const input = document.getElementById('finalVersion');
  const info = document.getElementById('finalVersionInfo');
  if (input) input.value = '';
  if (info) info.innerHTML = '';
}

// Form submission
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const submitBtn = document.getElementById('submitBtn');
  const errorDiv = document.getElementById('errorMessage');
  const progressSection = document.getElementById('progressSection');
  
  const serviceType = document.querySelector('input[name="serviceType"]:checked');
  if (!serviceType) {
    showError('Please select a service type');
    return;
  }

  const validationResult = validateFiles(serviceType.value);
  if (!validationResult.valid) {
    showError(validationResult.error);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading...';
  errorDiv.style.display = 'none';
  progressSection.style.display = 'block';

  try {
    const formData = new FormData();
    
    formData.append('artistName', document.getElementById('artistName').value);
    formData.append('email', document.getElementById('email').value);
    formData.append('phone', document.getElementById('phone').value);
    formData.append('projectName', document.getElementById('projectName').value);
    formData.append('serviceType', serviceType.value);
    formData.append('songKey', document.getElementById('songKey').value || '');
    formData.append('bpm', document.getElementById('bpm').value || '');
    formData.append('notes', document.getElementById('notes').value || '');

    if (serviceType.value === 'Initial/Re-Mastering') {
      const finalVersion = document.getElementById('finalVersion').files[0];
      formData.append('finalVersion', finalVersion);
    } else {
      const vocalStems = document.getElementById('vocalStems').files;
      for (let i = 0; i < vocalStems.length; i++) {
        formData.append('vocalStems', vocalStems[i]);
      }

      formData.append('instrumental', document.getElementById('instrumental').files[0]);
      formData.append('reference', document.getElementById('reference').files[0]);
      
      const masteredFinal = document.getElementById('masteredFinal').files[0];
      if (masteredFinal) {
        formData.append('masteredFinal', masteredFinal);
      }
    }

    const xhr = new XMLHttpRequest();
    
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
        const error = JSON.parse(xhr.responseText);
        showError(error.error || 'Upload failed. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Files';
        progressSection.style.display = 'none';
      }
    });

    xhr.addEventListener('error', () => {
      showError('Network error. Please check your connection and try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Files';
      progressSection.style.display = 'none';
    });

    xhr.open('POST', AZURE_FUNCTION_URL);
    xhr.send(formData);

  } catch (error) {
    showError('An unexpected error occurred: ' + error.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Files';
    progressSection.style.display = 'none';
  }
});

function validateFiles(serviceType) {
  if (serviceType === 'Initial/Re-Mastering') {
    const finalVersion = document.getElementById('finalVersion').files;
    if (finalVersion.length === 0) {
      return { valid: false, error: 'Please upload your Final Version file' };
    }
  } else {
    const vocalStems = document.getElementById('vocalStems').files;
    const instrumental = document.getElementById('instrumental').files;
    const reference = document.getElementById('reference').files;

    if (vocalStems.length === 0) {
      return { valid: false, error: 'Please upload at least one Vocal Stem' };
    }
    if (instrumental.length === 0) {
      return { valid: false, error: 'Please upload an Instrumental file' };
    }
    if (reference.length === 0) {
      return { valid: false, error: 'Please upload a Reference track' };
    }
  }

  return { valid: true };
}

function updateProgress(percent, loaded, total) {
  const progressFill = document.getElementById('progressFill');
  const progressDetails = document.getElementById('progressDetails');
  
  progressFill.style.width = percent + '%';
  progressFill.textContent = Math.round(percent) + '%';
  
  progressDetails.innerHTML = `
    Uploading: ${formatFileSize(loaded)} / ${formatFileSize(total)}
  `;
}

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showSuccess() {
  const form = document.getElementById('uploadForm');
  const successMessage = document.getElementById('successMessage');
  
  form.style.display = 'none';
  successMessage.style.display = 'block';
  
  let countdown = 15;
  const countdownSpan = document.getElementById('countdown');
  
  const timer = setInterval(() => {
    countdown--;
    countdownSpan.textContent = countdown;
    
    if (countdown <= 0) {
      clearInterval(timer);
      window.location.href = 'thankyou.html';
    }
  }, 1000);
}