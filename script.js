// Service pricing
const SERVICE_PRICING = {
  'Mixing': 30.00,
  'Initial/Re-Mastering': 15.00
};

// File categories and their limits
const FILE_CATEGORIES = {
  vocals: { limit: 10, files: [], prefix: 'vocals_' },
  instrumental: { limit: null, files: [], prefix: 'instrumental_' },
  sfx: { limit: null, files: [], prefix: 'sfx_' },
  reference: { limit: 1, files: [], prefix: 'reference_' },
  'lead-vocals': { limit: 10, files: [], prefix: 'lead_' },
  'bg-vocals': { limit: 10, files: [], prefix: 'harmony_' },
  adlibs: { limit: 10, files: [], prefix: 'adlib_' },
  'adv-instrumental': { limit: null, files: [], prefix: 'instrumental_' },
  'adv-sfx': { limit: null, files: [], prefix: 'sfx_' },
  'adv-reference': { limit: 1, files: [], prefix: 'reference_' },
  master: { limit: 1, files: [], prefix: 'master_' }
};

// Global state
let selectedService = null;
let currentMode = 'basic';
let totalFileCount = 0;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  setupServiceSelection();
  setupDropZones();
  setupModeToggle();
});

// Service selection
function setupServiceSelection() {
  const serviceRadios = document.querySelectorAll('input[name="serviceType"]');
  const formFields = document.getElementById('formFields');
  
  serviceRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      if (this.checked) {
        selectedService = this.value;
        formFields.classList.add('show');
        
        // Show appropriate upload section
        if (selectedService === 'Mixing') {
          document.getElementById('mixingUploads').style.display = 'block';
          document.getElementById('uploadModeToggle').style.display = 'flex';
          document.getElementById('masteringUploads').style.display = 'none';
        } else {
          document.getElementById('mixingUploads').style.display = 'none';
          document.getElementById('uploadModeToggle').style.display = 'none';
          document.getElementById('masteringUploads').style.display = 'block';
        }
        
        updatePriceDisplay();
        
        // Smooth scroll
        setTimeout(() => {
          formFields.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 300);
      }
    });
  });
}

// Mode toggle for mixing
function setupModeToggle() {
  window.setUploadMode = function(mode) {
    currentMode = mode;
    
    // Update buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Show/hide modes
    if (mode === 'basic') {
      document.getElementById('basicMode').style.display = 'block';
      document.getElementById('advancedMode').style.display = 'none';
    } else {
      document.getElementById('basicMode').style.display = 'none';
      document.getElementById('advancedMode').style.display = 'block';
    }
  };
}

// Setup all drop zones
function setupDropZones() {
  // Setup each drop zone
  const dropZones = [
    { zone: 'vocalDropZone', input: 'vocalFiles', category: 'vocals', list: 'vocalFileList', counter: 'vocalCounter' },
    { zone: 'instrumentalDropZone', input: 'instrumentalFiles', category: 'instrumental', list: 'instrumentalFileList' },
    { zone: 'sfxDropZone', input: 'sfxFiles', category: 'sfx', list: 'sfxFileList' },
    { zone: 'referenceDropZone', input: 'referenceFiles', category: 'reference', list: 'referenceFileList' },
    { zone: 'leadDropZone', input: 'leadFiles', category: 'lead-vocals', list: 'leadFileList', counter: 'leadCounter' },
    { zone: 'bgDropZone', input: 'bgFiles', category: 'bg-vocals', list: 'bgFileList', counter: 'bgCounter' },
    { zone: 'adlibDropZone', input: 'adlibFiles', category: 'adlibs', list: 'adlibFileList', counter: 'adlibCounter' },
    { zone: 'advInstrumentalDropZone', input: 'advInstrumentalFiles', category: 'adv-instrumental', list: 'advInstrumentalFileList' },
    { zone: 'advSfxDropZone', input: 'advSfxFiles', category: 'adv-sfx', list: 'advSfxFileList' },
    { zone: 'advReferenceDropZone', input: 'advReferenceFiles', category: 'adv-reference', list: 'advReferenceFileList' },
    { zone: 'masterDropZone', input: 'masterFiles', category: 'master', list: 'masterFileList' }
  ];
  
  dropZones.forEach(config => {
    const dropZone = document.getElementById(config.zone);
    const fileInput = document.getElementById(config.input);
    
    if (dropZone && fileInput) {
      // Click to upload
      dropZone.addEventListener('click', (e) => {
        if (!e.target.closest('.file-item')) {
          fileInput.click();
        }
      });
      
      // File input change
      fileInput.addEventListener('change', function() {
        handleFiles(this.files, config.category, config.list, config.counter);
      });
      
      // Drag over
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
      
      // Drag leave
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
      });
      
      // Drop
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files, config.category, config.list, config.counter);
      });
    }
  });
}

// Handle file uploads for specific category
function handleFiles(files, category, listId, counterId) {
  const fileArray = Array.from(files);
  const categoryData = FILE_CATEGORIES[category];
  const fileList = document.getElementById(listId);
  
  // Check category limit
  if (categoryData.limit && categoryData.files.length + fileArray.length > categoryData.limit) {
    alert(`This category has a limit of ${categoryData.limit} file(s).`);
    return;
  }
  
  // Add files
  fileArray.forEach(file => {
    // Auto-rename file
    const renamedFile = new File([file], categoryData.prefix + file.name, { type: file.type });
    categoryData.files.push(renamedFile);
    
    // Display file
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
      <span class="file-name">${file.name}</span>
      <span class="file-size">${formatFileSize(file.size)}</span>
      <button type="button" class="remove-file" onclick="removeFile('${category}', '${file.name}', '${listId}', '${counterId}')">Remove</button>
    `;
    fileList.appendChild(fileItem);
  });
  
  // Update counter if exists
  if (counterId) {
    updateFileCounter(category, counterId);
  }
  
  // Update drop zone appearance
  const dropZone = document.getElementById(listId).previousElementSibling;
  if (dropZone && categoryData.files.length > 0) {
    dropZone.classList.add('has-files');
  }
  
  // Check for warnings
  updateWarnings();
  updatecontinueButton();
}

// Remove file
window.removeFile = function(category, fileName, listId, counterId) {
  const categoryData = FILE_CATEGORIES[category];
  
  // Remove from array
  categoryData.files = categoryData.files.filter(f => !f.name.endsWith(fileName));
  
  // Rebuild display
  const fileList = document.getElementById(listId);
  fileList.innerHTML = '';
  categoryData.files.forEach(file => {
    const originalName = file.name.replace(categoryData.prefix, '');
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
      <span class="file-name">${originalName}</span>
      <span class="file-size">${formatFileSize(file.size)}</span>
      <button type="button" class="remove-file" onclick="removeFile('${category}', '${originalName}', '${listId}', '${counterId}')">Remove</button>
    `;
    fileList.appendChild(fileItem);
  });
  
  // Update counter
  if (counterId) {
    updateFileCounter(category, counterId);
  }
  
  // Update drop zone
  const dropZone = fileList.previousElementSibling;
  if (dropZone && categoryData.files.length === 0) {
    dropZone.classList.remove('has-files');
  }
  
  updateWarnings();
  updatecontinueButton();
};

// Update file counter display
function updateFileCounter(category, counterId) {
  const counter = document.getElementById(counterId);
  if (!counter) return;
  
  const categoryData = FILE_CATEGORIES[category];
  const count = categoryData.files.length;
  const limit = categoryData.limit;
  
  counter.textContent = `${count}/${limit} files`;
  
  // Update counter color based on count
  counter.classList.remove('warning', 'full');
  if (count >= 8 && count < 10) {
    counter.classList.add('warning');
  } else if (count >= 10) {
    counter.classList.add('full');
  }
  
  // Show extra warning for vocals if over 10
  if (category === 'vocals' && count > 10) {
    const warning = document.getElementById('vocalExtraWarning');
    if (warning) {
      const extra = count - 10;
      warning.innerHTML = `${extra} extra file(s) will incur $0.50 each = $${(extra * 0.50).toFixed(2)}`;
      warning.classList.add('show');
    }
  } else if (category === 'vocals') {
    const warning = document.getElementById('vocalExtraWarning');
    if (warning) {
      warning.classList.remove('show');
    }
  }
}

// Update global warnings
function updateWarnings() {
  // Count total files
  let total = 0;
  Object.keys(FILE_CATEGORIES).forEach(key => {
    if (currentMode === 'basic' && key.includes('adv-')) return;
    if (currentMode === 'advanced' && !key.includes('adv-') && !key.includes('-vocals')) return;
    total += FILE_CATEGORIES[key].files.length;
  });
  
  totalFileCount = total;
  
  // Show warning at 8+ total files
  const globalWarning = document.getElementById('globalFileWarning');
  if (globalWarning) {
    if (total >= 8) {
      globalWarning.innerHTML = 'Projects with more than 10 files will incur $0.50 per extra file';
      globalWarning.classList.add('show');
    } else {
      globalWarning.classList.remove('show');
    }
  }
  
  updatePriceDisplay();
}

// Update price display
function updatePriceDisplay() {
  const priceDisplay = document.getElementById('priceDisplay');
  if (!priceDisplay || !selectedService) return;
  
  const basePrice = SERVICE_PRICING[selectedService];
  let extraCost = 0;
  
  // Calculate extra files cost
  if (totalFileCount > 10) {
    extraCost = (totalFileCount - 10) * 0.50;
  }
  
  const totalPrice = basePrice + extraCost;
  
  let priceHTML = '<div class="price-summary">';
  priceHTML += `<div class="price-line">Base Service: $${basePrice.toFixed(2)}</div>`;
  
  if (extraCost > 0) {
    priceHTML += `<div class="price-line">Extra Files (${totalFileCount - 10} × $0.50): $${extraCost.toFixed(2)}</div>`;
  }
  
  priceHTML += `<div class="price-total">Total: $${totalPrice.toFixed(2)}</div>`;
  priceHTML += '</div>';
  
  priceDisplay.innerHTML = priceHTML;
}

// Update submit button state
function updatecontinueButton() {
  const continueButton = document.getElementById('continueButton');
  if (!continueButton) return;
  
  // Check if required files are uploaded
  let hasRequired = false;
  
  if (selectedService === 'Mixing') {
    if (currentMode === 'basic') {
      hasRequired = FILE_CATEGORIES.vocals.files.length > 0 && 
                   FILE_CATEGORIES.instrumental.files.length > 0;
    } else {
      const hasVocals = FILE_CATEGORIES['lead-vocals'].files.length > 0 ||
                       FILE_CATEGORIES['bg-vocals'].files.length > 0 ||
                       FILE_CATEGORIES.adlibs.files.length > 0;
      hasRequired = hasVocals && FILE_CATEGORIES['adv-instrumental'].files.length > 0;
    }
  } else {
    hasRequired = FILE_CATEGORIES.master.files.length > 0;
  }
  
  continueButton.disabled = !hasRequired;
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Form submission
document.addEventListener('DOMContentLoaded', function() {
  const uploadForm = document.getElementById('uploadForm');
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Show progress
      const progressSection = document.getElementById('progressSection');
      progressSection.classList.add('active');
      
      const progressBar = document.getElementById('progressBar');
      const progressPercentage = document.getElementById('overallPercentage');
      
      // Prepare form data
      const formData = new FormData();
      formData.append('serviceType', selectedService);
      formData.append('artistName', document.getElementById('artistName').value);
      formData.append('email', document.getElementById('email').value);
      formData.append('phone', document.getElementById('phone').value);
      formData.append('songTitle', document.getElementById('songTitle').value);
      formData.append('bpm', document.getElementById('bpm').value || 'Not specified');
      formData.append('key', document.getElementById('key').value || 'Not specified');
      formData.append('notes', document.getElementById('notes').value || 'None');
      
      // Add remaster flag if checked
      if (selectedService === 'Initial/Re-Mastering') {
        const isRemaster = document.getElementById('isRemaster').checked;
        formData.append('isRemaster', isRemaster);
      }
      
      // Calculate price
      const basePrice = SERVICE_PRICING[selectedService];
      const extraCost = totalFileCount > 10 ? (totalFileCount - 10) * 0.50 : 0;
      const totalPrice = basePrice + extraCost;
      formData.append('totalPrice', totalPrice.toFixed(2));
      
      // Add all files with prefixes
      Object.keys(FILE_CATEGORIES).forEach(key => {
        const category = FILE_CATEGORIES[key];
        category.files.forEach(file => {
          formData.append('files', file);
        });
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
          // Store for thank you page
          sessionStorage.setItem('orderStatus', 'Queued');
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
  }
});
