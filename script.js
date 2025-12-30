// AZURE FUNCTION URL - Already configured
const AZURE_FUNCTION_URL = 'https://legacy-crew-upload-v2-e8h4akc0brdsh5hd.westcentralus-01.azurewebsites.net/api/fileupload';

// Service pricing configuration
const SERVICE_PRICING = {
  'Mixing': 30.00,  // Includes mastering
  'Initial/Re-Mastering': 15.00  // Standalone mastering
};

// Order Status Definitions
const ORDER_STATUS = {
  QUEUED: 'Queued',
  IN_CORE: 'In Core',
  PROCESSING: 'Processing',
  FINALIZING: 'Finalizing',
  READY: 'Ready'
};

// Status descriptions for customer clarity
const STATUS_DESCRIPTIONS = {
  'Queued': 'Your order is in line for processing',
  'In Core': 'Files received and being prepared',
  'Processing': 'Our engineers are working on your music',
  'Finalizing': 'Final quality checks and export',
  'Ready': 'Your tracks are ready for download!'
};

// Global state
let selectedService = null;
let orderStatus = null;
let extraFilesCount = 0;
let selectedFiles = [];

// Show form fields when service is selected
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
        
        // Smooth scroll to form fields
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
    
    let priceHTML = `<div class="price-summary">`;
    priceHTML += `<div class="price-line">Base Service: $${basePrice.toFixed(2)}</div>`;
    
    if (extraFilesCount > 0) {
      priceHTML += `<div class="price-line">Extra Files (${extraFilesCount} × $0.50): $${extraCost.toFixed(2)}</div>`;
    }
    
    priceHTML += `<div class="price-total">Total: $${totalPrice.toFixed(2)}</div>`;
    priceHTML += `</div>`;
    
    priceDisplay.innerHTML = priceHTML;
  }
}

// Update upload instructions based on service
function updateUploadInstructions(serviceType) {
  const instructions = document.getElementById('uploadInstructions');
  const requirements = document.getElementById('fileRequirements');
  
  if (serviceType === 'Mixing') {
    instructions.innerHTML = 'Upload your vocal stems, instrumental, and reference track';
    requirements.innerHTML = `
      <strong>Required:</strong> Vocal stems and instrumental<br>
      <strong>Optional:</strong> Sound effects and additional elements<br>
      <strong>Highly Recommended:</strong> Reference track for mixing direction<br>
      <strong>Format:</strong> WAV 24-bit @ 48kHz recommended
    `;
  } else {
    instructions.innerHTML = 'Upload your mixed track for mastering';
    requirements.innerHTML = `
      <strong>Required:</strong> Your final stereo mix<br>
      <strong>Format:</strong> WAV 24-bit with -3dB to -6dB headroom recommended<br>
      <strong>Note:</strong> Check "Re-master" if this is a revision of previous mastering
    `;
  }
}

// File upload handling
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const dropZone = document.getElementById('dropZone');

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
  
  // Check for vocal files limit (10 standard, extra cost after)
  let vocalFiles = files.filter(f => 
    f.name.toLowerCase().includes('vocal') || 
    f.name.toLowerCase().includes('vox')
  );
  
  if (vocalFiles.length > 10) {
    const extra = vocalFiles.length - 10;
    if (confirm(`You have ${vocalFiles.length} vocal files. Files over 10 will cost $0.50 each ($${(extra * 0.50).toFixed(2)} extra). Continue?`)) {
      extraFilesCount = extra;
      updatePriceDisplay();
    } else {
      return;
    }
  }
  
  files.forEach(file => {
    selectedFiles.push(file);
    displayFile(file);
  });
  
  updateSubmitButton();
}

function displayFile(file) {
  const fileItem = document.createElement('div');
  fileItem.className = 'file-item';
  
  // Auto-categorize files
  let category = detectFileCategory(file.name);
  
  fileItem.innerHTML = `
    <span class="file-name">${category}: ${file.name}</span>
    <span class="file-size">${formatFileSize(file.size)}</span>
    <button type="button" class="remove-file" onclick="removeFile('${file.name}')">Remove</button>
  `;
  
  fileList.appendChild(fileItem);
}

function detectFileCategory(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes('vocal') || lower.includes('vox')) return '🎤 Vocals';
  if (lower.includes('beat') || lower.includes('instrumental') || lower.includes('inst')) return '🎵 Instrumental';
  if (lower.includes('ref') || lower.includes('reference')) return '📊 Reference';
  if (lower.includes('sfx') || lower.includes('effect')) return '🎭 SFX';
  if (lower.includes('master') || lower.includes('final')) return '🎧 Master';
  return '📁 Audio';
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
  
  // Recalculate extra files
  let vocalFiles = selectedFiles.filter(f => 
    f.name.toLowerCase().includes('vocal') || 
    f.name.toLowerCase().includes('vox')
  );
  extraFilesCount = Math.max(0, vocalFiles.length - 10);
  updatePriceDisplay();
  
  // Rebuild file list display
  fileList.innerHTML = '';
  selectedFiles.forEach(file => displayFile(file));
  
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
  
  // Show progress
  const progressSection = document.getElementById('progressSection');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  
  progressSection.style.display = 'block';
  
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
  
  try {
    // Upload files
    const response = await fetch(AZURE_FUNCTION_URL, {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      // Set initial order status
      orderStatus = ORDER_STATUS.QUEUED;
      
      // Store order data for thank you page
      sessionStorage.setItem('orderStatus', orderStatus);
      sessionStorage.setItem('orderService', selectedService);
      sessionStorage.setItem('orderPrice', totalPrice.toFixed(2));
      sessionStorage.setItem('songTitle', document.getElementById('songTitle').value);
      
      // Redirect to thank you page
      window.location.href = 'thankyou.html';
    } else {
      throw new Error('Upload failed');
    }
  } catch (error) {
    console.error('Upload error:', error);
    alert('There was an error uploading your files. Please try again or contact support.');
    progressSection.style.display = 'none';
  }
});
