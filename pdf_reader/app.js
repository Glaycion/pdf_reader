"use strict";

(() => {
  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  const fileInput = document.querySelector("#file-input");
  const dropZone = document.querySelector("#drop-zone");
  const selectedPanel = document.querySelector("#selected-file");
  const errorMessage = document.querySelector("#error-message");
  const errorText = document.querySelector("#error-text");
  const status = document.querySelector("#upload-status");
  const dialog = document.querySelector("#preview-dialog");
  const previewContent = document.querySelector("#preview-content");
  const chooseButton = document.querySelector("#choose-file");
  const replaceButton = document.querySelector("#replace-file");
  const previewButton = document.querySelector("#preview-file");
  const originalLink = document.querySelector("#open-original");
  const downloadLink = document.querySelector("#download-original");
  let currentFile = null;
  let currentUrl = null;
  let selectionVersion = 0;
  let dragDepth = 0;

  function announce(message) {
    status.textContent = message;
  }

  function showError(message) {
    errorText.textContent = message;
    errorMessage.hidden = false;
  }

  function clearError() {
    errorMessage.hidden = true;
    errorText.textContent = "";
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(bytes / 1024)} КБ`;
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} МБ`;
  }

  function setBusy(busy) {
    chooseButton.disabled = busy;
    replaceButton.disabled = busy;
    dropZone.classList.toggle("is-busy", busy);
    dropZone.setAttribute("aria-busy", String(busy));
    selectedPanel.setAttribute("aria-busy", String(busy));
  }

  function clearPreview() {
    if (dialog.open) dialog.close();
    previewContent.replaceChildren();
    originalLink.removeAttribute("href");
    downloadLink.removeAttribute("href");
    downloadLink.removeAttribute("download");
  }

  function releaseFile() {
    clearPreview();
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = null;
    currentFile = null;
  }

  async function selectFiles(files) {
    const version = ++selectionVersion;
    setBusy(false);
    clearError();
    if (!files || files.length === 0) return;
    if (files.length !== 1) {
      showError("Добавьте один документ за раз. Выберите один PDF-файл.");
      return;
    }

    const file = files[0];
    if (!/\.pdf$/i.test(file.name)) {
      showError("Этот формат не поддерживается. Выберите файл с расширением .pdf.");
      return;
    }
    if (file.size === 0) {
      showError("Этот файл пуст. Выберите другой PDF-документ.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showError("Файл больше 20 МБ. Выберите PDF меньшего размера.");
      return;
    }

    setBusy(true);
    announce("Проверяем формат документа…");

    try {
      const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
      if (version !== selectionVersion) return;
      const isPdf = header.length === 5 && header.every((byte, index) => byte === [37, 80, 68, 70, 45][index]);
      if (!isPdf) {
        showError("Не удалось распознать PDF. Проверьте, что это PDF-документ, а не переименованный файл.");
        announce("Документ не добавлен.");
        return;
      }

      // Set the correct MIME type even when the operating system supplies none.
      const nextUrl = URL.createObjectURL(file.slice(0, file.size, "application/pdf"));
      releaseFile();
      currentFile = file;
      currentUrl = nextUrl;
      document.querySelector("#file-name").textContent = file.name;
      document.querySelector("#file-name").title = file.name;
      document.querySelector("#file-size").textContent = `${formatSize(file.size)} · PDF-документ`;
      selectedPanel.hidden = false;
      dropZone.hidden = true;
      announce(`Документ ${file.name} добавлен. Доступен предпросмотр.`);
      previewButton.focus({ preventScroll: true });
    } catch {
      if (version !== selectionVersion) return;
      showError("Не удалось прочитать файл. Попробуйте выбрать его ещё раз.");
      announce("Документ не добавлен.");
    } finally {
      if (version === selectionVersion) setBusy(false);
    }
  }

  function chooseFile() {
    // Reset before opening so selecting the same file still raises change.
    fileInput.value = "";
    fileInput.click();
  }

  chooseButton.addEventListener("click", chooseFile);
  replaceButton.addEventListener("click", chooseFile);
  fileInput.addEventListener("change", () => selectFiles(fileInput.files));

  document.querySelector("#remove-file").addEventListener("click", () => {
    selectionVersion++;
    setBusy(false);
    releaseFile();
    fileInput.value = "";
    document.querySelector("#file-name").textContent = "";
    document.querySelector("#file-name").removeAttribute("title");
    document.querySelector("#file-size").textContent = "";
    selectedPanel.hidden = true;
    dropZone.hidden = false;
    clearError();
    announce("Документ убран. Можно выбрать новый PDF.");
    chooseButton.focus({ preventScroll: true });
  });

  // Prevent the browser from navigating away when a file misses the drop zone.
  function isFileDrag(event) {
    return Array.from(event.dataTransfer?.types || []).includes("Files");
  }

  window.addEventListener("dragover", (event) => {
    if (isFileDrag(event)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "none";
    }
  });
  window.addEventListener("drop", (event) => {
    if (isFileDrag(event)) event.preventDefault();
    dragDepth = 0;
    dropZone.classList.remove("is-dragging");
  });

  dropZone.addEventListener("dragenter", (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth++;
    dropZone.classList.add("is-dragging");
  });
  dropZone.addEventListener("dragover", (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  });
  dropZone.addEventListener("dragleave", (event) => {
    if (!isFileDrag(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropZone.classList.remove("is-dragging");
  });
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth = 0;
    dropZone.classList.remove("is-dragging");
    if (event.dataTransfer?.files.length) selectFiles(event.dataTransfer.files);
  });

  previewButton.addEventListener("click", () => {
    if (!currentFile || !currentUrl) return;
    document.querySelector("#preview-title").textContent = currentFile.name;
    const pdf = document.createElement("object");
    pdf.className = "pdf-object";
    pdf.type = "application/pdf";
    pdf.data = currentUrl;
    pdf.setAttribute("aria-label", `Предпросмотр: ${currentFile.name}`);

    const fallback = document.createElement("div");
    fallback.className = "preview-fallback";
    const fallbackHeading = document.createElement("h3");
    fallbackHeading.textContent = "Документ готов к открытию";
    const fallbackDescription = document.createElement("p");
    fallbackDescription.textContent = "В этом браузере нет встроенного просмотра PDF. Скачайте документ и откройте его на устройстве.";
    const link = document.createElement("a");
    link.href = currentUrl;
    link.download = currentFile.name;
    link.className = "button button-primary";
    link.textContent = "Скачать PDF";
    fallback.append(fallbackHeading, fallbackDescription, link);
    pdf.append(fallback);
    const showFallback = () => {
      if (previewContent.contains(pdf)) previewContent.replaceChildren(fallback);
    };
    pdf.addEventListener("error", showFallback);
    pdf.addEventListener("load", () => {
      // Some embedded browsers advertise a PDF viewer but leave a blank frame.
      try {
        if (pdf.contentDocument?.URL === "about:blank") showFallback();
      } catch {
        // Native PDF viewers may isolate their document from the page.
      }
    });
    previewContent.replaceChildren(navigator.pdfViewerEnabled === false ? fallback : pdf);
    originalLink.href = currentUrl;
    downloadLink.href = currentUrl;
    downloadLink.download = currentFile.name;
    dialog.showModal();
    document.body.style.overflow = "hidden";
  });

  document.querySelector("#close-preview").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener("close", () => {
    previewContent.replaceChildren();
    document.body.style.overflow = "";
  });

  // Release the in-memory document when leaving, while preserving back/forward cache.
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) releaseFile();
  });
})();
