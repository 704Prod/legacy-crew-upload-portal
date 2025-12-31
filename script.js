// AZURE FUNCTION URL
const AZURE_FUNCTION_URL = 'https://legacy-crew-upload-v2-e8h4akc0brdsh5hd.westcentralus-01.azurewebsites.net/api/fileupload';

// Service pricing
const SERVICE_PRICING = {
  'Mixing': 30.00,
  'Initial/Re-Mastering': 15.00
};

// Order Status
const ORDER_STATUS = {
  QUEUED: 'Queued',
  IN_CORE: 'In Core',
  PROCESSING: 'Processing',
  FINALIZING: 'Finalizing',
  READY: 'Ready'
};

// Global state
let selectedService = null;
let orderStatus = null;
let extraFilesCount = 0;
let selectedFiles = [];

// Show form fields when service selected
document.addEventListener('DOMContentLoaded', function() {
  const serviceRadios = document.querySelectorAll('input[name="serviceType"]');
  const formFields = document.getElementById('formFields');
  
  serviceRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      if (this.checked) {
        selectedService = this.value;
        formFields.classList.add('show');
        updateUploadInstructions(this.value);
        updatePriceDisplay();
        
        setTimeout(() => {
          formFields.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 300);
      }
    });
  });
});

// Update price display
function updatePriceDisplay() {
  const priceDisplay = document.getElementById('priceDisplay');
  if (priceDisplay && selectedService) {
    const basePrice = SERVICE_PRICING[selectedService];
    const extraCost = extraFilesCount * 0.50;
    const totalPrice = basePrice + extraCost;
    
    let priceHTML = '<div class="price-summary">';
    priceHTML += `<div class="price-line">Base Service: $${basePrice.toFixed(2)}</div>`;
    
    if (extraFilesCount > 0) {
      priceHTML += `<div class="price-line">Extra Files (${extraFilesCount} × $0.50): $${extraCost.toFixed(2)}</div>`;
    }
    
    priceHTML += `<div class="price-total">Total: $${totalPrice.toFixed(2)}</div>`;
    priceHTML += '</div>';
    
    priceDisplay.innerHTML = priceHTML;
  }
}

// Update instructions based on service
function updateUploadInstructions(serviceType) {
  const instructions = document.getElementById('uploadInstructions');
  const requirements = document.getElementById('fileRequirements');
  
  if (serviceType === 'Mixing') {
    instructions.innerHTML = 'Upload your vocal stems, instrumental, and reference track';
    requirements.innerHTML = `
      <strong>Required:</strong> Vocal stems and instrumental<br>
      <strong>Optional:</strong> Sound effects and additional elements<br>
      <strong>Recommended:</strong> Reference track for mixing direction<br>
      <strong>Format:</strong> WAV 24-bit @ 48kHz recommended
    `;
  } else {
    instructions.innerHTML = 'Upload your mixed track for mastering';
    requirements.innerHTML = `
      <strong>Required:</strong> Your final stereo mix<br>
      <strong>Format:</strong> WAV 24-bit with -3dB to -6dB headroom recommended
    `;
  }
}

// File upload handling
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const dropZone = document.getElementById('dropZone');

// Click on drop zone to open file dialog
dropZone.addEventListener('click', (e) => {
  if (!e.target.closest('.file-item') && !e.target.closest('.remove-file')) {
    fileInput.click();
  }
});

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
    selectedFiles.push(file);
    displayFile(file);
  });
  
  updateFileWarning();
  updateSubmitButton();
}

// Update file warning - only show at 8+ files
function updateFileWarning() {
  const fileWarning = document.getElementById('fileWarning');
  const totalFiles = selectedFiles.length;
  
  // Show warning at 8+ files
  if (totalFiles >= 8) {
    fileWarning.innerHTML = 'Projects with more than 10 files will incur $0.50 per extra file';
    fileWarning.classList.add('show');
  } else {
    fileWarning.classList.remove('show');
  }
  
  // Calculate extra files if over 10
  if (totalFiles > 10) {
    extraFilesCount = totalFiles - 10;
  } else {
    extraFilesCount = 0;
  }
  updatePriceDisplay();
}

function displayFile(file) {
  const fileItem = document.createElement('div');
  fileItem.className = 'file-item';
  
  fileItem.innerHTML = `
    <span class="file-name">${file.name}</span>
    <span class="file-size">${formatFileSize(file.size)}</span>
    <button type="button" class="remove-file" onclick="removeFile('${file.name}')">Remove</button>
  `;
  
  fileList.appendChild(fileItem);
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function removeFile(fileName) {
  selectedFiles = selectedFiles.filter(file => file.name !== fileName);
  
  // Rebuild file list
  fileList.innerHTML = '';
  selectedFiles.forEach(file => displayFile(file));
  
  updateFileWarning();
  updateSubmitButton();
}

function updateSubmitButton() {
  const submitButton = document.getElementById('submitButton');
  if (submitButton) {
    submitButton.disabled = selectedFiles.length === 0;
  }
}

// Form submission
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // NOW show the progress section
  const progressSection = document.getElementById('progressSection');
  progressSection.classList.add('active');
  
  const progressBar = document.getElementById('progressBar');
  const progressPercentage = document.getElementById('overallPercentage');
  
  // Prepare form data
  const formData = new FormData();
  formData.append('serviceType', document.querySelector('input[name="serviceType"]:checked').value);
  formData.append('artistName', document.getElementById('artistName').value);
  formData.append('email', document.getElementById('email').value);
  formData.append('phone', document.getElementById('phone').value);
  formData.append('songTitle', document.getElementById('songTitle').value);
  formData.append('bpm', document.getElementById('bpm').value || 'Not specified');
  formData.append('key', document.getElementById('key').value || 'Not specified');
  formData.append('notes', document.getElementById('notes').value || 'None');
  
  // Calculate total price
  const basePrice = SERVICE_PRICING[selectedService];
  const totalPrice = basePrice + (extraFilesCount * 0.50);
  formData.append('totalPrice', totalPrice.toFixed(2));
  formData.append('extraFiles', extraFilesCount);
  
  // Add files
  selectedFiles.forEach(file => {
    formData.append('files', file);
  });
  
  // Simulate progress
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += 10;
    progressBar.style.width = progress + '%';
    progressPercentage.textContent = progress + '%';
    
    if (progress >= 100) {
      clearInterval(progressInterval);
    }
  }, 300);
  
  try {
    const response = await fetch(AZURE_FUNCTION_URL, {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      orderStatus = ORDER_STATUS.QUEUED;
      
      // Store for thank you page
      sessionStorage.setItem('orderStatus', orderStatus);
      sessionStorage.setItem('orderService', selectedService);
      sessionStorage.setItem('orderPrice', totalPrice.toFixed(2));
      sessionStorage.setItem('songTitle', document.getElementById('songTitle').value);
      
      // Show success
      document.getElementById('successMessage').style.display = 'block';
      
      // Redirect
      setTimeout(() => {
        window.location.href = 'thankyou.html';
      }, 2000);
    } else {
      throw new Error('Upload failed');
    }
  } catch (error) {
    console.error('Upload error:', error);
    document.getElementById('errorMessage').innerHTML = 'There was an error uploading your files. Please try again or contact support.';
    document.getElementById('errorMessage').style.display = 'block';
    progressSection.classList.remove('active');
  }
});
