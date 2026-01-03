/* script.js — Legacy Crew Upload Portal (Basic/Advanced Mixing + Mastering)
   - Fixed to work with modified HTML structure with service cards
   - Ensures service card clicks properly reveal form fields
*/

(() => {
  // ---------- Pricing (display-only here; Stripe logic lives in stripe-integration.js) ----------
  const SERVICE_PRICING = {
    "Mixing": 30.0,
    "Initial/Re-Mastering": 15.0
  };

  // ---------- Categories + limits ----------
  const FILE_CATEGORIES = {
    // Basic mixing
    vocals: { limit: 10, files: [], prefix: "vocals_" },
    instrumental: { limit: null, files: [], prefix: "instrumental_" },
    reference: { limit: 1, files: [], prefix: "reference_" },

    // Advanced mixing
    "lead-vocals": { limit: 10, files: [], prefix: "lead_" },
    "bg-vocals": { limit: 10, files: [], prefix: "bg_" },
    adlibs: { limit: 10, files: [], prefix: "adlibs_" },
    "adv-instrumental": { limit: null, files: [], prefix: "instrumental_" },
    "adv-sfx": { limit: null, files: [], prefix: "sfx_" },
    "adv-reference": { limit: 1, files: [], prefix: "reference_" },

    // Mastering
    master: { limit: 1, files: [], prefix: "master_" }
  };

  // ---------- State ----------
  let selectedService = null; // "Mixing" or "Initial/Re-Mastering"
  let uploadMode = "basic";   // "basic" or "advanced" (only used for mixing)

  // ---------- Helpers ----------
  function money(n) {
    const v = Number.isFinite(n) ? n : 0;
    return `$${v.toFixed(2)}`;
  }

  function clearWarnings() {
    const globalFileWarning = document.getElementById("globalFileWarning");
    if (globalFileWarning) globalFileWarning.textContent = "";
    const vocalExtraWarning = document.getElementById("vocalExtraWarning");
    if (vocalExtraWarning) vocalExtraWarning.textContent = "";
  }

  function setGlobalWarning(msg) {
    const globalFileWarning = document.getElementById("globalFileWarning");
    if (!globalFileWarning) return;
    globalFileWarning.textContent = msg || "";
  }

  function updateCounters() {
    const vocalCounter = document.getElementById("vocalCounter");
    const leadCounter = document.getElementById("leadCounter");
    const bgCounter = document.getElementById("bgCounter");
    const adlibCounter = document.getElementById("adlibCounter");
    
    if (vocalCounter) vocalCounter.textContent = `${FILE_CATEGORIES.vocals.files.length}/10 files`;
    if (leadCounter) leadCounter.textContent = `${FILE_CATEGORIES["lead-vocals"].files.length}/10 files`;
    if (bgCounter) bgCounter.textContent = `${FILE_CATEGORIES["bg-vocals"].files.length}/10 files`;
    if (adlibCounter) adlibCounter.textContent = `${FILE_CATEGORIES.adlibs.files.length}/10 files`;
  }

  function getActiveCategoryKeys() {
    if (selectedService === "Initial/Re-Mastering") return ["master"];

    if (selectedService === "Mixing") {
      if (uploadMode === "basic") return ["vocals", "instrumental", "reference"];
      return ["lead-vocals", "bg-vocals", "adlibs", "adv-instrumental", "adv-sfx", "adv-reference"];
    }

    return [];
  }

  function getActiveFilesFlat() {
    const keys = getActiveCategoryKeys();
    const out = [];
    keys.forEach((k) => {
      FILE_CATEGORIES[k].files.forEach((f) => out.push({ category: k, file: f }));
    });
    return out;
  }

  function requiredFilesSatisfied() {
    if (selectedService === "Initial/Re-Mastering") {
      return FILE_CATEGORIES.master.files.length >= 1;
    }

    if (selectedService === "Mixing") {
      if (uploadMode === "basic") {
        return FILE_CATEGORIES.vocals.files.length >= 1 && FILE_CATEGORIES.instrumental.files.length >= 1;
      }

      const anyVocals =
        FILE_CATEGORIES["lead-vocals"].files.length +
          FILE_CATEGORIES["bg-vocals"].files.length +
          FILE_CATEGORIES.adlibs.files.length >
        0;

      return anyVocals && FILE_CATEGORIES["adv-instrumental"].files.length >= 1;
    }

    return false;
  }

  function updateContinueButtonState() {
    const continueButton = document.getElementById("continueButton");
    if (!continueButton) return;
    continueButton.disabled = !requiredFilesSatisfied();
  }

  function applyUploadModeUI() {
    const basicModeEl = document.getElementById("basicMode");
    const advancedModeEl = document.getElementById("advancedMode");
    
    if (!basicModeEl || !advancedModeEl) return;

    if (uploadMode === "basic") {
      basicModeEl.style.display = "block";
      advancedModeEl.style.display = "none";
    } else {
      basicModeEl.style.display = "none";
      advancedModeEl.style.display = "block";
    }

    // Update active button state in toggle
    const uploadModeToggle = document.getElementById("uploadModeToggle");
    if (uploadModeToggle) {
      const btns = uploadModeToggle.querySelectorAll(".mode-btn");
      btns.forEach((b) => b.classList.remove("active"));
      btns.forEach((b) => {
        const t = (b.textContent || "").toLowerCase();
        if (uploadMode === "basic" && t.includes("basic")) b.classList.add("active");
        if (uploadMode === "advanced" && t.includes("advanced")) b.classList.add("active");
      });
    }

    clearWarnings();
    updateContinueButtonState();
  }

  function showServiceUI(serviceValue) {
    selectedService = serviceValue;
    console.log("ShowServiceUI called with:", serviceValue);
     console.log("formFields computed BEFORE:", getComputedStyle(document.getElementById("formFields")).display);


    // Show form fields area - CRITICAL
    const formFields = document.getElementById("formFields");
    if (formFields) {
      formFields.style.setProperty("display", "block", "important");
      console.log("Form fields shown (forced !important)");
       console.log("formFields computed AFTER:", getComputedStyle(formFields).display);
    }

    // Price display
    const priceDisplay = document.getElementById("priceDisplay");
    const base = SERVICE_PRICING[selectedService] || 0;
    if (priceDisplay) {
      priceDisplay.textContent =
        selectedService === "Mixing"
          ? `Selected Service: Mixing (${money(base)})`
          : `Selected Service: Mastering (${money(base)})`;
    }

    clearWarnings();

    const mixingUploads = document.getElementById("mixingUploads");
    const masteringUploads = document.getElementById("masteringUploads");
    const uploadModeToggle = document.getElementById("uploadModeToggle");
    const remasterOption = document.getElementById("remasterOption");
    const isRemasterEl = document.getElementById("isRemaster");

    if (selectedService === "Mixing") {
      if (mixingUploads) mixingUploads.style.display = "block";
      if (masteringUploads) masteringUploads.style.display = "none";
      if (uploadModeToggle) uploadModeToggle.style.display = "flex";

      // Remaster only for mastering
      if (remasterOption) remasterOption.style.display = "none";
      if (isRemasterEl) isRemasterEl.checked = false;

      applyUploadModeUI();
    } else if (selectedService === "Initial/Re-Mastering") {
      if (mixingUploads) mixingUploads.style.display = "none";
      if (masteringUploads) masteringUploads.style.display = "block";
      if (uploadModeToggle) uploadModeToggle.style.display = "none";

      // Show remaster option for mastering
      if (remasterOption) remasterOption.style.display = "block";
    }

    updateContinueButtonState();
  }

  // ---------- Dropzone binding ----------
  function renderFileList(listEl, categoryKey) {
    if (!listEl) return;

    const files = FILE_CATEGORIES[categoryKey].files;
    listEl.innerHTML = "";

    files.forEach((file, idx) => {
      const row = document.createElement("div");
      row.className = "file-row";

      const name = document.createElement("div");
      name.className = "file-name";
      name.textContent = file.name;

      const meta = document.createElement("div");
      meta.className = "file-meta";

      const size = document.createElement("span");
      size.className = "file-size";
      size.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

      const btn = document.createElement("button");
      btn.className = "remove-file-btn";
      btn.textContent = "Remove";
      btn.onclick = () => removeFileFromCategory(categoryKey, idx, listEl);

      meta.appendChild(size);
      meta.appendChild(btn);

      row.appendChild(name);
      row.appendChild(meta);

      listEl.appendChild(row);
    });
  }

  function removeFileFromCategory(categoryKey, idx, listEl) {
    FILE_CATEGORIES[categoryKey].files.splice(idx, 1);
    renderFileList(listEl, categoryKey);
    updateCounters();
    updateContinueButtonState();
  }

  function enforceLimitOrWarn(categoryKey, incomingCount) {
    const limit = FILE_CATEGORIES[categoryKey].limit;
    if (!limit) return true;

    const current = FILE_CATEGORIES[categoryKey].files.length;
    if (current + incomingCount <= limit) return true;

    setGlobalWarning(`File limit exceeded for "${categoryKey}". Max allowed: ${limit}.`);
    return false;
  }

  function addFilesToCategory(categoryKey, fileList, listEl) {
    if (!FILE_CATEGORIES[categoryKey]) return;

    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    clearWarnings();

    const limit = FILE_CATEGORIES[categoryKey].limit;

    // Single-file categories replace
    if (limit === 1) {
      FILE_CATEGORIES[categoryKey].files = [files[0]];
      renderFileList(listEl, categoryKey);
      updateCounters();
      updateContinueButtonState();
      return;
    }

    if (!enforceLimitOrWarn(categoryKey, files.length)) return;

    FILE_CATEGORIES[categoryKey].files.push(...files);

    renderFileList(listEl, categoryKey);
    updateCounters();
    updateContinueButtonState();
  }

  function bindDropZone(dropZoneId, inputId, listId, categoryKey) {
    const dropZone = document.getElementById(dropZoneId);
    const input = document.getElementById(inputId);
    const listEl = document.getElementById(listId);

    if (!dropZone || !input) return;

    dropZone.addEventListener("click", () => input.click());

    input.addEventListener("change", (e) => {
      addFilesToCategory(categoryKey, e.target.files, listEl);
      input.value = "";
    });

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      addFilesToCategory(categoryKey, e.dataTransfer.files, listEl);
    });
  }

  // ---------- Public functions (called from HTML onclick) ----------
  window.setUploadMode = function (e, mode) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    if (selectedService !== "Mixing") return;

    uploadMode = mode === "advanced" ? "advanced" : "basic";
    applyUploadModeUI();
  };

  window.showPaymentSection = function () {
    clearWarnings();
    if (!requiredFilesSatisfied()) {
      setGlobalWarning("Add the required files before continuing.");
      return;
    }

    const artistName = (document.getElementById("artistName")?.value || "").trim();
    const email = (document.getElementById("email")?.value || "").trim();
    const phone = (document.getElementById("phone")?.value || "").trim();
    const songTitle = (document.getElementById("songTitle")?.value || "").trim();

    if (!artistName || !email || !phone || !songTitle) {
      setGlobalWarning("Complete all required Contact Information fields before continuing.");
      return;
    }

    const base = SERVICE_PRICING[selectedService] || 0;
    const activeFiles = getActiveFilesFlat();

    const summaryService = document.getElementById("summaryService");
    const summarySong = document.getElementById("summarySong");
    const summaryArtist = document.getElementById("summaryArtist");
    const summaryFiles = document.getElementById("summaryFiles");
    const summaryTotal = document.getElementById("summaryTotal");
    const basePriceLine = document.getElementById("basePrice");
    const extraFilesLine = document.getElementById("extraFilesLine");

    if (summaryService) summaryService.textContent = selectedService === "Mixing" ? "Mixing" : "Mastering";
    if (summarySong) summarySong.textContent = songTitle;
    if (summaryArtist) summaryArtist.textContent = artistName;
    if (summaryFiles) summaryFiles.textContent = `${activeFiles.length} file(s)`;

    if (basePriceLine) {
      const right = basePriceLine.querySelector("span:last-child");
      if (right) right.textContent = money(base);
    }

    if (extraFilesLine) extraFilesLine.style.display = "none";
    if (summaryTotal) summaryTotal.textContent = money(base);

    const uploadForm = document.getElementById("uploadForm");
    const paymentSection = document.getElementById("paymentSection");
    
    if (uploadForm) uploadForm.style.display = "none";
    if (paymentSection) paymentSection.style.display = "block";

    const isRemaster = !!document.getElementById("isRemaster")?.checked;

    window.__getActiveFilesForUpload = () => getActiveFilesFlat().map((x) => x.file);
    window.__getActiveFilesForManifest = () =>
      getActiveFilesFlat().map(({ category, file }) => ({
        category,
        originalName: file.name,
        suggestedName: `${FILE_CATEGORIES[category].prefix}${file.name}`
      }));
    window.__getSelectedService = () => selectedService;
    window.__getUploadMode = () => uploadMode;
    window.__getProjectFlags = () => ({ isRemaster });
  };

  window.backToFiles = function () {
    const uploadForm = document.getElementById("uploadForm");
    const paymentSection = document.getElementById("paymentSection");
    if (paymentSection) paymentSection.style.display = "none";
    if (uploadForm) uploadForm.style.display = "block";
    clearWarnings();
    updateContinueButtonState();
  };

  // ---------- Init ----------
  function initServiceSelection() {
    console.log("Initializing service selection...");
    
    const masteringRadio = document.getElementById("serviceTypeMastering");
    const mixingRadio = document.getElementById("serviceTypeMixing");

    // APPROACH 1: Direct click handlers on service cards
    const serviceCards = document.querySelectorAll(".service-card");
    serviceCards.forEach(card => {
      card.addEventListener("click", function(e) {
        console.log("Service card clicked");
        
        // Find the parent label
        const label = this.closest("label.service-option");
        if (!label) return;
        
        // Find the radio input
        const radio = label.querySelector('input[type="radio"]');
        if (!radio) return;
        
        // Prevent default and stop propagation
        e.preventDefault();
        e.stopPropagation();
        
        // Force check the radio
        radio.checked = true;
        
        // Force UI update
        showServiceUI(radio.value);
        
        // Dispatch change event
        radio.dispatchEvent(new Event("change", { bubbles: true }));
        
        console.log("Radio checked:", radio.value, radio.checked);
      });
    });

    // APPROACH 2: Click handler on service options (labels)
    const serviceOptions = document.querySelectorAll(".service-option");
    serviceOptions.forEach(option => {
      option.addEventListener("click", function(e) {
        console.log("Service option clicked");
        
        const radio = this.querySelector('input[type="radio"]');
        if (!radio) return;
        
        // If clicking on the radio itself, let default behavior handle it
        if (e.target === radio) {
          showServiceUI(radio.value);
          return;
        }
        
        // Otherwise manually handle the click
        e.preventDefault();
        radio.checked = true;
        showServiceUI(radio.value);
        radio.dispatchEvent(new Event("change", { bubbles: true }));
        
        console.log("Radio checked via option:", radio.value, radio.checked);
      });
    });

    // APPROACH 3: Direct change listeners on radios as fallback
    if (masteringRadio) {
      masteringRadio.addEventListener("change", function() {
        console.log("Mastering radio changed:", this.checked);
        if (this.checked) {
          showServiceUI(this.value);
        }
      });
    }

    if (mixingRadio) {
      mixingRadio.addEventListener("change", function() {
        console.log("Mixing radio changed:", this.checked);
        if (this.checked) {
          showServiceUI(this.value);
        }
      });
    }

    console.log("Service selection initialized with:", {
      serviceCards: serviceCards.length,
      serviceOptions: serviceOptions.length,
      masteringRadio: !!masteringRadio,
      mixingRadio: !!mixingRadio
    });
  }

  function initDropZones() {
    // Basic
    bindDropZone("vocalDropZone", "vocalFiles", "vocalFileList", "vocals");
    bindDropZone("instrumentalDropZone", "instrumentalFiles", "instrumentalFileList", "instrumental");
    bindDropZone("referenceDropZone", "referenceFiles", "referenceFileList", "reference");

    // Advanced
    bindDropZone("leadDropZone", "leadFiles", "leadFileList", "lead-vocals");
    bindDropZone("bgDropZone", "bgFiles", "bgFileList", "bg-vocals");
    bindDropZone("adlibDropZone", "adlibFiles", "adlibFileList", "adlibs");
    bindDropZone("advInstrumentalDropZone", "advInstrumentalFiles", "advInstrumentalFileList", "adv-instrumental");
    bindDropZone("advSfxDropZone", "advSfxFiles", "advSfxFileList", "adv-sfx");
    bindDropZone("advReferenceDropZone", "advReferenceFiles", "advReferenceFileList", "adv-reference");

    // Mastering
    bindDropZone("masterDropZone", "masterFiles", "masterFileList", "master");
  }

  function init() {
    console.log("=== Legacy Crew Portal Init ===");
    console.log("DOM ready state:", document.readyState);
    
    // Hide fields until service selected
    const formFields = document.getElementById("formFields");
    if (formFields) {
      formFields.style.display = "none";
      console.log("Form fields hidden initially");
    }

    // Start state
    const mixingUploads = document.getElementById("mixingUploads");
    const masteringUploads = document.getElementById("masteringUploads");
    const uploadModeToggle = document.getElementById("uploadModeToggle");
    const remasterOption = document.getElementById("remasterOption");
    
    if (mixingUploads) mixingUploads.style.display = "none";
    if (masteringUploads) masteringUploads.style.display = "none";
    if (uploadModeToggle) uploadModeToggle.style.display = "none";
    if (remasterOption) remasterOption.style.display = "none";

    initServiceSelection();
    initDropZones();

    updateCounters();
    updateContinueButtonState();
    
    console.log("=== Init Complete ===");
  }

  // CRITICAL: Run init regardless of DOM state
  if (document.readyState === "loading") {
    console.log("Waiting for DOMContentLoaded...");
    document.addEventListener("DOMContentLoaded", init);
  } else {
    console.log("DOM already loaded, running init immediately");
    // Use timeout to ensure all scripts are loaded
    setTimeout(init, 0);
  }
})();
