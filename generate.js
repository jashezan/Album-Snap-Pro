window.onload = async function () {
    // === 1. UI Elements ===
    const ui = {
        grid: document.getElementById('grid'),
        countStr: document.getElementById('countStr'),
        sizeStr: document.getElementById('sizeStr'),
        btnExport: document.getElementById('btnExport'),
        btnZip: document.getElementById('btnZip'),
        btnSelectAll: document.getElementById('btnSelectAll'),
        btnInvert: document.getElementById('btnInvert'),
        overlay: document.getElementById('overlay'),
        pFill: document.getElementById('pFill'),
        sTitle: document.getElementById('sTitle'),
        sDesc: document.getElementById('sDesc')
    };

    // === 2. Helpers ===
    const formatBytes = (bytes) => {
        if (!+bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    };

    // Reset modal to default state
    const resetModal = () => {
        ui.pFill.style.width = '0%';
        ui.pFill.style.background = '#3b82f6';
        ui.sTitle.innerText = 'Processing...';
        ui.sDesc.innerText = 'Initializing...';
    };

    // === 3. Data Initialization ===
    const result = await chrome.storage.local.get("fb_pdf_data");
    const rawData = result.fb_pdf_data || [];

    if (rawData.length === 0) {
        // Fallback for testing or empty state
        // In prod, this might show a "No data" UI
    }

    const images = rawData.map((img, idx) => ({
        ...img,
        id: `card_${idx}`,
        byteSize: Math.round((img.data.length * 0.75)),
        isLowRes: (img.w < 600 || img.h < 600),
        aspect: img.w > img.h ? 'Landscape' : (img.w === img.h ? 'Square' : 'Portrait'),
        rotation: 0  // Rotation in degrees: 0, 90, 180, 270
    }));

    // === 4. Render Grid ===
    const createCard = (img, index) => {
        const div = document.createElement('div');
        div.className = 'card selected';
        div.draggable = true;
        div.dataset.id = img.id;
        div.dataset.bytes = img.byteSize;

        const warningHTML = img.isLowRes
            ? `<div class="warning-badge" title="Low Resolution Image">!</div>`
            : '';

        div.innerHTML = `
            <div class="check-circle" title="Toggle Selection"></div>
            <div class="serial-badge">#${index + 1}</div>
            ${warningHTML}
            
            <div class="thumb-wrapper">
                <img class="card-thumb rotated" src="${img.data}" loading="lazy" style="transform: rotate(${img.rotation}deg)">
                <div class="rotate-controls">
                    <button class="rotate-btn rotate-left" title="Rotate Left">↺</button>
                    <button class="rotate-btn rotate-right" title="Rotate Right">↻</button>
                </div>
            </div>

            <div class="meta">
                <span class="res-badge">${img.aspect}</span>
                <span class="size-text">${formatBytes(img.byteSize)}</span>
            </div>
        `;

        // Handle card selection click
        div.onclick = (e) => {
            // Ignore clicks on rotate buttons
            if (e.target.classList.contains('rotate-btn')) return;

            if (div.classList.contains('just-dragged')) {
                div.classList.remove('just-dragged');
                return;
            }
            div.classList.toggle('selected');
            div.classList.toggle('excluded');
            updateStats();
        };

        // Handle rotation button clicks
        const rotateLeft = div.querySelector('.rotate-left');
        const rotateRight = div.querySelector('.rotate-right');
        const thumbImg = div.querySelector('.card-thumb');

        rotateLeft.onclick = (e) => {
            e.stopPropagation();
            img.rotation = (img.rotation - 90 + 360) % 360;
            thumbImg.style.transform = `rotate(${img.rotation}deg)`;
        };

        rotateRight.onclick = (e) => {
            e.stopPropagation();
            img.rotation = (img.rotation + 90) % 360;
            thumbImg.style.transform = `rotate(${img.rotation}deg)`;
        };

        attachDragEvents(div);
        return div;
    };

    const frag = document.createDocumentFragment();
    images.forEach((img, idx) => frag.appendChild(createCard(img, idx)));
    ui.grid.appendChild(frag);
    updateStats();

    // === 5. Advanced Ghost Drag & Drop ===
    let dragSrc = null;
    let ghost = null;

    function attachDragEvents(card) {
        card.addEventListener('dragstart', function (e) {
            dragSrc = this;
            this.classList.add('dragging');

            // Create ghost placeholder
            ghost = document.createElement('div');
            ghost.className = 'card ghost-card';
            // Match dimensions approximately
            ghost.style.height = this.offsetHeight + 'px';

            setTimeout(() => {
                this.style.display = 'none';
                this.parentNode.insertBefore(ghost, this.nextSibling);
            }, 0);

            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', '');
        });

        card.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (this === ghost || this === dragSrc) return;

            const rect = this.getBoundingClientRect();
            const midpoint = rect.x + rect.width / 2;

            if (e.clientX < midpoint) {
                this.parentNode.insertBefore(ghost, this);
            } else {
                this.parentNode.insertBefore(ghost, this.nextSibling);
            }
        });

        card.addEventListener('dragend', function () {
            this.style.display = 'flex';
            this.classList.remove('dragging');

            if (ghost && ghost.parentNode) {
                ghost.parentNode.insertBefore(this, ghost);
                ghost.parentNode.removeChild(ghost);
            }

            this.classList.add('just-dragged');
            ghost = null;
            dragSrc = null;
            refreshSerials();
        });
    }

    function refreshSerials() {
        const cards = Array.from(ui.grid.querySelectorAll('.card:not(.ghost-card)'));
        cards.forEach((card, idx) => {
            const serialBadge = card.querySelector('.serial-badge');
            if (serialBadge) serialBadge.innerText = `#${idx + 1}`;
        });
    }

    // === 6. Statistics ===
    function updateStats() {
        const cards = Array.from(ui.grid.querySelectorAll('.card:not(.ghost-card)'));
        const selected = cards.filter(c => c.classList.contains('selected'));
        let totalSize = 0;
        selected.forEach(c => totalSize += parseInt(c.dataset.bytes || 0));

        ui.countStr.innerText = `${selected.length}/${cards.length}`;
        ui.sizeStr.innerText = formatBytes(totalSize);

        const disabled = selected.length === 0;
        ui.btnExport.disabled = disabled;
        ui.btnExport.style.opacity = disabled ? 0.5 : 1;
        ui.btnZip.disabled = disabled;
        ui.btnZip.style.opacity = disabled ? 0.5 : 1;
    }

    // === Helper: Rotate Image using Canvas ===
    const rotateImageData = (base64Data, rotation, originalW, originalH) => {
        return new Promise((resolve) => {
            if (rotation === 0) {
                resolve({ data: base64Data, w: originalW, h: originalH });
                return;
            }

            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Swap dimensions for 90° and 270° rotations
                if (rotation === 90 || rotation === 270) {
                    canvas.width = originalH;
                    canvas.height = originalW;
                } else {
                    canvas.width = originalW;
                    canvas.height = originalH;
                }

                // Move to center, rotate, draw image offset
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate((rotation * Math.PI) / 180);
                ctx.drawImage(img, -originalW / 2, -originalH / 2);

                resolve({
                    data: canvas.toDataURL('image/jpeg', 0.92),
                    w: canvas.width,
                    h: canvas.height
                });
            };
            img.src = base64Data;
        });
    };

    // === 7. Toolbar ===
    ui.btnSelectAll.onclick = () => {
        Array.from(ui.grid.children).forEach(c => {
            if (!c.classList.contains('ghost-card')) {
                c.classList.add('selected'); c.classList.remove('excluded');
            }
        });
        updateStats();
    };

    ui.btnInvert.onclick = () => {
        Array.from(ui.grid.children).forEach(c => {
            if (!c.classList.contains('ghost-card')) {
                if (c.classList.contains('selected')) {
                    c.classList.remove('selected'); c.classList.add('excluded');
                } else {
                    c.classList.add('selected'); c.classList.remove('excluded');
                }
            }
        });
        updateStats();
    };

    // === 8. Export Logic ===
    ui.btnExport.onclick = async () => {
        try {
            // A. Get Data
            const cards = Array.from(ui.grid.children).filter(c => !c.classList.contains('ghost-card'));
            const finalImages = [];

            cards.forEach(c => {
                if (c.classList.contains('selected')) {
                    const id = c.dataset.id;
                    const imgData = images.find(i => i.id === id);
                    if (imgData) finalImages.push(imgData);
                }
            });

            if (finalImages.length === 0) {
                alert("Please select at least one image.");
                return;
            }

            // B. Init UI
            resetModal();
            ui.sTitle.innerText = 'Generating PDF';
            ui.overlay.style.display = 'flex';

            // Validate Library
            if (!window.jspdf || !window.jspdf.jsPDF) {
                throw new Error("jsPDF library not loaded.");
            }

            const { jsPDF } = window.jspdf;

            // C. Create PDF
            // Get first image with rotation applied for initial page size
            const firstRotated = await rotateImageData(
                finalImages[0].data,
                finalImages[0].rotation,
                finalImages[0].w,
                finalImages[0].h
            );

            const pdf = new jsPDF({
                orientation: firstRotated.w > firstRotated.h ? 'l' : 'p',
                unit: 'px',
                format: [firstRotated.w, firstRotated.h]
            });

            for (let i = 0; i < finalImages.length; i++) {
                const img = finalImages[i];

                // Update Progress
                const pct = Math.round(((i + 1) / finalImages.length) * 100);
                ui.pFill.style.width = `${pct}%`;
                ui.sDesc.innerText = `Processing page ${i + 1} of ${finalImages.length}`;

                // Force Repaint
                await new Promise(r => setTimeout(r, 20));

                // Apply rotation if needed
                const rotated = await rotateImageData(img.data, img.rotation, img.w, img.h);

                if (i > 0) {
                    const orientation = rotated.w > rotated.h ? 'l' : 'p';
                    pdf.addPage([rotated.w, rotated.h], orientation);
                }

                // CRITICAL: Pass 'null' for format to let jsPDF auto-detect
                pdf.addImage(rotated.data, null, 0, 0, rotated.w, rotated.h);
            }

            // D. Save
            ui.sTitle.innerText = "Done!";
            ui.sDesc.innerText = "Downloading PDF...";
            ui.pFill.style.background = "#10b981"; // Success green

            await new Promise(r => setTimeout(r, 800));

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            pdf.save(`Facebook_Album_${timestamp}.pdf`);

            ui.sDesc.innerText = "Closing studio...";
            chrome.storage.local.remove("fb_pdf_data");
            setTimeout(() => window.close(), 2000);

        } catch (error) {
            console.error(error);
            alert("PDF Generation Error: " + error.message);
            ui.overlay.style.display = 'none';
        }
    };

    // === 9. ZIP Export Logic ===
    ui.btnZip.onclick = async () => {
        try {
            // A. Get Data
            const cards = Array.from(ui.grid.children).filter(c => !c.classList.contains('ghost-card'));
            const finalImages = [];

            cards.forEach(c => {
                if (c.classList.contains('selected')) {
                    const id = c.dataset.id;
                    const imgData = images.find(i => i.id === id);
                    if (imgData) finalImages.push(imgData);
                }
            });

            if (finalImages.length === 0) {
                alert("Please select at least one image.");
                return;
            }

            // B. Init UI
            resetModal();
            ui.sTitle.innerText = 'Creating ZIP';
            ui.overlay.style.display = 'flex';

            // Validate Library
            if (typeof JSZip === 'undefined') {
                throw new Error("JSZip library not loaded.");
            }

            // C. Create ZIP
            const zip = new JSZip();

            for (let i = 0; i < finalImages.length; i++) {
                const img = finalImages[i];

                // Update Progress
                const pct = Math.round(((i + 1) / finalImages.length) * 100);
                ui.pFill.style.width = `${pct}%`;
                ui.sDesc.innerText = `Adding image ${i + 1} of ${finalImages.length}`;

                // Force Repaint
                await new Promise(r => setTimeout(r, 10));

                // Apply rotation if needed
                const rotated = await rotateImageData(img.data, img.rotation, img.w, img.h);

                // Convert base64 to binary
                const base64Data = rotated.data.split(',')[1];
                const extension = rotated.data.includes('image/png') ? 'png' : 'jpg';
                const fileName = `image_${String(i + 1).padStart(3, '0')}.${extension}`;

                zip.file(fileName, base64Data, { base64: true });
            }

            // D. Generate and Save
            ui.sDesc.innerText = "Compressing files...";
            await new Promise(r => setTimeout(r, 100));

            const blob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            }, (metadata) => {
                ui.pFill.style.width = `${Math.round(metadata.percent)}%`;
            });

            ui.sTitle.innerText = "Done!";
            ui.sDesc.innerText = "Downloading ZIP...";
            ui.pFill.style.background = "#10b981"; // Success green

            await new Promise(r => setTimeout(r, 800));

            // Create download link
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `Facebook_Album_${timestamp}.zip`;
            link.click();
            URL.revokeObjectURL(downloadUrl);

            ui.sDesc.innerText = "Closing studio...";
            chrome.storage.local.remove("fb_pdf_data");
            setTimeout(() => window.close(), 2000);

        } catch (error) {
            console.error(error);
            alert("ZIP Generation Error: " + error.message);
            ui.overlay.style.display = 'none';
        }
    };
};