// =============================================================
// REAMAL Trade — Chart Uploader Module
// File: public/js/uploader.js
// =============================================================
// Handles all chart image input methods:
//   1. Click to browse & select file
//   2. Drag & drop image onto upload area
//   3. Ctrl+V / Cmd+V paste from clipboard
//      (take screenshot on TradingView → paste here instantly)
// Validates image, shows preview, and enables Analyze button.
// =============================================================

// =============================================================
// STATE
// =============================================================

const UploaderState = {
  imageBase64: null,   // Base64 encoded image data
  imageType:   null,   // MIME type e.g. "image/png"
  fileName:    null,   // Original file name (if from file browser)
};

// Make state accessible to analysis module
window.UploaderState = UploaderState;

// =============================================================
// DOM REFERENCES
// =============================================================

let uploadArea, uploadContent, chartPreview,
    fileInput, uploadBtn, uploadActions,
    uploadFilename, analyzeBtn, clearChart;

function initDOMRefs() {
  uploadArea     = document.getElementById("uploadArea");
  uploadContent  = document.getElementById("uploadContent");
  chartPreview   = document.getElementById("chartPreview");
  fileInput      = document.getElementById("fileInput");
  uploadBtn      = document.getElementById("uploadBtn");
  uploadActions  = document.getElementById("uploadActions");
  uploadFilename = document.getElementById("uploadFilename");
  analyzeBtn     = document.getElementById("analyzeBtn");
  clearChart     = document.getElementById("clearChart");
}

// =============================================================
// IMAGE VALIDATION
// =============================================================

const MAX_SIZE_MB  = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES  = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

function validateImage(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    showToast("❌ Unsupported format. Please use PNG, JPG, WEBP, or GIF.", "error");
    return false;
  }
  if (file.size > MAX_SIZE_BYTES) {
    showToast(`❌ Image too large. Max size is ${MAX_SIZE_MB}MB.`, "error");
    return false;
  }
  return true;
}

// =============================================================
// LOAD IMAGE — converts File/Blob to base64 and shows preview
// =============================================================

function loadImage(file, nameOverride = null) {
  if (!validateImage(file)) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    const dataUrl  = e.target.result;

    // Strip the data URL prefix to get raw base64
    const base64   = dataUrl.split(",")[1];
    const mimeType = file.type || "image/png";

    // Save to state
    UploaderState.imageBase64 = base64;
    UploaderState.imageType   = mimeType;
    UploaderState.fileName    = nameOverride || file.name || "chart.png";

    // Show preview
    chartPreview.src = dataUrl;
    chartPreview.classList.remove("hidden");
    uploadContent.classList.add("hidden");
    uploadArea.classList.add("has-image");

    // Show file info & clear button
    uploadActions.style.display = "flex";
    uploadFilename.textContent  = UploaderState.fileName;

    // Enable analyze button
    analyzeBtn.disabled = false;

    showToast("✅ Chart loaded. Click Analyze Chart to begin.", "success");
  };

  reader.onerror = () => {
    showToast("❌ Failed to read image. Please try again.", "error");
  };

  reader.readAsDataURL(file);
}

// =============================================================
// CLEAR IMAGE
// =============================================================

function clearImage() {
  UploaderState.imageBase64 = null;
  UploaderState.imageType   = null;
  UploaderState.fileName    = null;

  chartPreview.src           = "";
  chartPreview.classList.add("hidden");
  uploadContent.classList.remove("hidden");
  uploadArea.classList.remove("has-image");

  uploadActions.style.display = "none";
  uploadFilename.textContent  = "";
  fileInput.value             = "";

  analyzeBtn.disabled         = true;

  showToast("Chart cleared.", "info", 2000);
}

// =============================================================
// METHOD 1 — CLICK TO BROWSE
// =============================================================

function initClickUpload() {
  // Clicking the upload area opens file picker
  uploadArea.addEventListener("click", (e) => {
    // Don't trigger if clicking clear button or analyze button
    if (e.target.closest("#clearChart") || e.target.closest("#analyzeBtn")) return;
    // Don't re-open if image already loaded and clicking preview
    if (UploaderState.imageBase64 && e.target === chartPreview) return;
    fileInput.click();
  });

  // Upload button click
  uploadBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  // File input change
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) loadImage(file);
  });
}

// =============================================================
// METHOD 2 — DRAG & DROP
// =============================================================

function initDragDrop() {
  // Prevent default browser behavior for drag events
  ["dragenter", "dragover", "dragleave", "drop"].forEach((event) => {
    uploadArea.addEventListener(event, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    document.body.addEventListener(event, (e) => {
      e.preventDefault();
    });
  });

  // Visual feedback on drag enter/over
  uploadArea.addEventListener("dragenter", () => {
    uploadArea.classList.add("drag-over");
  });

  uploadArea.addEventListener("dragover", () => {
    uploadArea.classList.add("drag-over");
  });

  // Remove visual feedback on drag leave
  uploadArea.addEventListener("dragleave", (e) => {
    // Only remove if leaving the upload area entirely
    if (!uploadArea.contains(e.relatedTarget)) {
      uploadArea.classList.remove("drag-over");
    }
  });

  // Handle drop
  uploadArea.addEventListener("drop", (e) => {
    uploadArea.classList.remove("drag-over");

    const files = e.dataTransfer?.files;
    const items = e.dataTransfer?.items;

    // Try to get image from dropped files
    if (files && files.length > 0) {
      const imageFile = Array.from(files).find((f) =>
        ALLOWED_TYPES.includes(f.type)
      );
      if (imageFile) {
        loadImage(imageFile);
        return;
      }
    }

    // Try to get image from dropped items (e.g. dragged from browser)
    if (items) {
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            loadImage(file);
            return;
          }
        }
      }
    }

    showToast("❌ No image found. Please drop a chart image file.", "error");
  });
}

// =============================================================
// METHOD 3 — CTRL+V PASTE FROM CLIPBOARD
// =============================================================

function initPasteUpload() {
  document.addEventListener("paste", async (e) => {
    // Don't intercept paste in text inputs
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (["input", "textarea", "select"].includes(tag)) return;

    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;

    // Look for an image in clipboard
    for (const item of clipboardItems) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          // Generate a timestamped name for pasted images
          const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
          const ext       = item.type.split("/")[1] || "png";
          const name      = `chart-paste-${timestamp}.${ext}`;
          loadImage(file, name);
          showToast("📋 Chart pasted from clipboard!", "success");
          return;
        }
      }
    }

    // If user pasted but no image found
    showToast("💡 No image in clipboard. Try taking a screenshot first.", "info");
  });
}

// =============================================================
// CLEAR BUTTON
// =============================================================

function initClearButton() {
  clearChart?.addEventListener("click", (e) => {
    e.stopPropagation();
    clearImage();
  });
}

// =============================================================
// ANALYZE BUTTON — triggers analysis module
// =============================================================

function initAnalyzeButton() {
  analyzeBtn?.addEventListener("click", () => {
    if (!UploaderState.imageBase64) {
      showToast("⚠️ Please upload a chart image first.", "error");
      return;
    }
    // Call the analysis module
    if (typeof runAnalysis === "function") {
      runAnalysis();
    } else {
      showToast("❌ Analysis module not loaded.", "error");
    }
  });
}

// =============================================================
// LOADING STATE — called by analysis module
// =============================================================

function setAnalyzeLoading(isLoading) {
  const btn     = document.getElementById("analyzeBtn");
  const btnText = document.getElementById("analyzeBtnText");
  if (!btn || !btnText) return;

  if (isLoading) {
    btn.disabled      = true;
    btnText.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px"><span class="loading-spinner sm" style="border-color:#00000033;border-top-color:#000"></span> Analyzing...</span>';
  } else {
    btn.disabled      = false;
    btnText.textContent = "🤖 Analyze Chart";
  }
}

window.setAnalyzeLoading = setAnalyzeLoading;

// =============================================================
// INITIALIZE
// =============================================================

document.addEventListener("DOMContentLoaded", () => {
  initDOMRefs();
  initClickUpload();
  initDragDrop();
  initPasteUpload();
  initClearButton();
  initAnalyzeButton();

  console.log("📸 Uploader ready — supports click, drag & drop, and Ctrl+V paste");
});
