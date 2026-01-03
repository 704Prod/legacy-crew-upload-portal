/* script.js — Legacy Crew Upload Portal (Basic/Advanced Mixing + Mastering)
   - Matches the IDs in your posted index.html
   - Fixes mode toggle, dropzone binding, required-file logic
   - Ensures ONLY active mode files are counted and summarized
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

  // ---------- DOM ----------
  const formFields = document.getElementById("formFields");
  const priceDisplay = document.getElementById("priceDisplay");
  const continueButton = document.getElementById("continueButton");
  const globalFileWarning = document.getElementById("globalFileWarning");

  const mixingUploads = document.getElementById("mixingUploads");
  const masteringUploads = document.getElementById("masteringUploads");
  const uploadModeToggle = document.getElementById("uploadModeToggle");
  const basicModeEl = document.getElementById("basicMode");
  const advancedModeEl = document.getElementById("advancedMode");

  const vocalCounter = document.getElementById("vocalCounter");
  const leadCounter = document.getElementById("leadCounter");
  const bgCounter = document.getElementById("bgCounter");
  const adlibCounter = document.getElementById("adlibCounter");

  // Summary fields (payment step)
  const summaryService = document.getElementById("summaryService");
  const summarySong = document.getElementById("summarySong");
  const summaryArtist = document.getElementById("summaryArtist");
  const summaryFiles = document.getElementById("summaryFiles");
  const summaryTotal = document.getElementById("summaryTotal");
  const basePriceLine = document.getElementById("basePrice");
  const extraFilesLine = document.getElementById("extraFilesLine");

  // Payment/section containers
  const paymentSection = document.getElementById("paymentSection");

  // ---------- Helpers ----------
  function money(n) {
    const v = Number.isFinite(n) ? n : 0;
    return `$${v.toFixed(2)}`;
  }

  function clearWarnings() {
    if (globalFileWarning) globalFileWarning.textContent = "";
    const vocalExtraWarning = document.getElementById("vocalExtraWarning");
    if (vocalExtraWarning) vocalExtraWarning.textContent = "";
  }

  function setGlobalWarning(msg) {
    if (!globalFileWarning) return;
    globalFileWarning.textContent = msg || "";
  }

  function resetAllFiles() {
    Object.keys(FILE_CATEGORIES).forEach((k) => (FILE_CATEGORIES[k].files = []));
    // Clear UI lists
    const lists = [
      "vocalFileList",
      "instrumentalFileList",
      "referenceFileList",
      "leadFileList",
      "bgFileList",
      "adlibFileList",
      "advInstrumentalFileList",
      "advSfxFileList",
      "advReferenceFileList",
      "masterFileList"
    ];
    lists.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = "";
    });
    updateCounters();
    updateContinueButtonState();
  }

  function updateCounters() {
    if (vocalCounter) vocalCounter.textContent = `${FILE_CATEGORIES.vocals.files.length}/10 files`;
    if (leadCounter) leadCounter.textContent = `${FILE_CATEGORIES["lead-vocals"].files.length}/10 files`;
    if (bgCounter) bgCounter.textContent = `${FILE_CATEGORIES["bg-vocals"].files.length}/10 files`;
    if (adlibCounter) adlibCounter.textContent = `${FILE_CATEGORIES.adlibs.files.length}/10 files`;
  }

  function getActiveCategoryKeys() {
    if (selectedService === "Initial/Re-Mastering") {
      return ["master"];
    }

    if (selectedService === "Mixing") {
      if (uploadMode === "basic") {
        return ["vocals", "instrumental", "reference"];
      }
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
    // Only gate on required files here (contact fields can be validated in payment step)
    continueButton.disabled = !requiredFilesSatisfied();
  }

  function showServiceUI(serviceValue) {
    selectedService = serviceValue;

    // Show form fields area
    if (formFields) formFields.style.display = "block";

    // Price display
    const base = SERVICE_PRICING[selectedService] || 0;
    if (priceDisplay) {
      priceDisplay.textContent =
        selectedService === "Mixing"
          ? `Selected Service: Mixing (${money(base)})`
          : `Selected Service: Mastering (${money(base)})`;
    }

    // Toggle upload sections
    clearWarnings();

    if (selectedService === "Mixing") {
      if (mixingUploads) mixingUploads.style.display = "block";
      if (masteringUploads) masteringUploads.style.display = "none";
      if (uploadModeToggle) uploadModeToggle.style.display = "flex";

      // Ensure correct mode visible
      applyUploadModeUI();
    } else {
      if (mixingUploads) mixingUploads.style.display = "none";
      if (masteringUploads) masteringUploads.style.display = "block";
      if (uploadModeToggle) uploadModeToggle.style.display = "none";
    }

    updateContinueButtonState();
  }

  function applyUploadModeUI() {
    if (!basicModeEl || !advancedModeEl) return;

    if (uploadMode === "basic") {
      basicModeEl.style.display = "block";
      advancedModeEl.style.display = "none";
    } else {
      basicModeEl.style.display = "none";
      advancedModeEl.style.display = "block";
    }

    // Update active button state in toggle
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
      meta.textContent = `${Math.max(1, Math.round(file.size / 1024))} KB`;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "file-remove";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        FILE_CATEGORIES[categoryKey].files.splice(idx, 1);
        renderFileList(listEl, categoryKey);
        updateCounters();
        updateContinueButtonState();
      });

      row.appendChild(name);
      row.appendChild(meta);
      row.appendChild(remove);
      listEl.appendChild(row);
    });
  }

  function enforceLimitOrWarn(categoryKey, incomingCount) {
    const limit = FILE_CATEGORIES[categoryKey].limit;
    if (!limit) return true;

    const current = FILE_CATEGORIES[categoryKey].files.length;
    if (current + incomingCount <= limit) return true;

    // Limit exceeded -> warning
    setGlobalWarning(`File limit exceeded for "${categoryKey}". Max allowed: ${limit}.`);
    return false;
  }

  function addFilesToCategory(categoryKey, fileList, listEl, counterElOptional) {
    if (!FILE_CATEGORIES[categoryKey]) return;

    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    clearWarnings();

    // If limit is 1, replace existing
    const limit = FILE_CATEGORIES[categoryKey].limit;
    if (limit === 1) {
      FILE_CATEGORIES[categoryKey].files = [files[0]];
      renderFileList(listEl, categoryKey);
      updateCounters();
      updateContinueButtonState();
      return;
    }

    // Enforce limit (hard stop)
    if (!enforceLimitOrWarn(categoryKey, files.length)) return;

    // Append
    FILE_CATEGORIES[categoryKey].files.push(...files);

    renderFileList(listEl, categoryKey);
    updateCounters();
    updateContinueButtonState();

    // Optional counter update (already handled globally)
    if (counterElOptional) {
      // no-op (kept for future extension)
    }
  }

  function bindDropZone(dropZoneId, inputId, listId, categoryKey) {
    const dropZone = document.getElementById(dropZoneId);
    const input = document.getElementById(inputId);
    const listEl = document.getElementById(listId);

    if (!dropZone || !input) return;

    // Click -> open file picker
    dropZone.addEventListener("click", () => input.click());

    // Input change -> add files
    input.addEventListener("change", (e) => {
      addFilesToCategory(categoryKey, e.target.files, listEl);
      // Reset input so selecting the same file again triggers change
      input.value = "";
    });

    // Drag events
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

    // Only applicable to Mixing
    if (selectedService !== "Mixing") return;

    uploadMode = mode === "advanced" ? "advanced" : "basic";
    applyUploadModeUI();
  };

  window.showPaymentSection = function () {
    // Validate required files first
    clearWarnings();
    if (!requiredFilesSatisfied()) {
      setGlobalWarning("Add the required files before continuing.");
      return;
    }

    // Minimal required contact validation before payment
    const artistName = (document.getElementById("artistName")?.value || "").trim();
    const email = (document.getElementById("email")?.value || "").trim();
    const phone = (document.getElementById("phone")?.value || "").trim();
    const songTitle = (document.getElementById("songTitle")?.value || "").trim();

    if (!artistName || !email || !phone || !songTitle) {
      setGlobalWarning("Complete all required Contact Information fields before continuing.");
      return;
    }

    // Fill order summary
    const base = SERVICE_PRICING[selectedService] || 0;
    const activeFiles = getActiveFilesFlat();

    if (summaryService) summaryService.textContent = selectedService === "Mixing" ? "Mixing" : "Mastering";
    if (summarySong) summarySong.textContent = songTitle;
    if (summaryArtist) summaryArtist.textContent = artistName;
    if (summaryFiles) summaryFiles.textContent = `${activeFiles.length} file(s)`;

    if (basePriceLine) {
      const right = basePriceLine.querySelector("span:last-child");
      if (right) right.textContent = money(base);
    }

    // If you later add extra-file pricing, wire it here:
    if (extraFilesLine) extraFilesLine.style.display = "none";

    if (summaryTotal) summaryTotal.textContent = money(base);

    // Show payment section
    const container = document.querySelector(".container");
    if (container) container.scrollTop = 0;

    const uploadForm = document.getElementById("uploadForm");
    if (uploadForm) uploadForm.style.display = "none";
    if (paymentSection) paymentSection.style.display = "block";

    // IMPORTANT:
    // stripe-integration.js should read the same active files.
    // Expose getter for it:
    window.__getActiveFilesForUpload = () => getActiveFilesFlat().map((x) => x.file);
    window.__getActiveFilesForManifest = () => {
      // Provide category + prefixed name idea for backend manifest use if needed
      return getActiveFilesFlat().map(({ category, file }) => ({
        category,
        originalName: file.name,
        suggestedName: `${FILE_CATEGORIES[category].prefix}${file.name}`
      }));
    };
    window.__getSelectedService = () => selectedService;
    window.__getUploadMode = () => uploadMode;
  };

  window.backToFiles = function () {
    const uploadForm = document.getElementById("uploadForm");
    if (paymentSection) paymentSection.style.display = "none";
    if (uploadForm) uploadForm.style.display = "block";
    clearWarnings();
    updateContinueButtonState();
  };

  // ---------- Init ----------
  function initServiceSelection() {
    const masteringRadio = document.getElementById("serviceTypeMastering");
    const mixingRadio = document.getElementById("serviceTypeMixing");

    const onChange = () => {
      const selected =
        (mixingRadio && mixingRadio.checked && mixingRadio.value) ||
        (masteringRadio && masteringRadio.checked && masteringRadio.value) ||
        null;

      if (!selected) return;

      // Reset payment section if user goes back and changes service
      if (paymentSection) paymentSection.style.display = "none";
      const uploadForm = document.getElementById("uploadForm");
      if (uploadForm) uploadForm.style.display = "block";

      showServiceUI(selected);
    };

    if (masteringRadio) masteringRadio.addEventListener("change", onChange);
    if (mixingRadio) mixingRadio.addEventListener("change", onChange);
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
    // Hide fields until service selected
    if (formFields) formFields.style.display = "none";

    // Start state
    if (mixingUploads) mixingUploads.style.display = "none";
    if (masteringUploads) masteringUploads.style.display = "none";
    if (uploadModeToggle) uploadModeToggle.style.display = "none";

    // Bind
    initServiceSelection();
    initDropZones();

    // Counters
    updateCounters();
    updateContinueButtonState();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
