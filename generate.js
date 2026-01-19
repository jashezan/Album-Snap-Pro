window.onload = async function () {
    // === 1. UI Elements ===
    const ui = {
        grid: document.getElementById('grid'),
        countStr: document.getElementById('countStr'),
        sizeStr: document.getElementById('sizeStr'),
        btnExport: document.getElementById('btnExport'),
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
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${['B', 'KB', 'MB'][i]}`;
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
        aspect: img.w > img.h ? 'Landscape' : (img.w === img.h ? 'Square' : 'Portrait')
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
                <img class="card-thumb" src="${img.data}" loading="lazy">
            </div>

            <div class="meta">
                <span class="res-badge">${img.aspect}</span>
                <span class="size-text">${formatBytes(img.byteSize)}</span>
            </div>
        `;

        div.onclick = (e) => {
            if (div.classList.contains('just-dragged')) {
                div.classList.remove('just-dragged');
                return;
            }
            // Prevent deselecting when clicking specifically on drag areas if needed,
            // but for now, clicking anywhere toggles state
            div.classList.toggle('selected');
            div.classList.toggle('excluded');
            updateStats();
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

        if (selected.length === 0) {
            ui.btnExport.disabled = true;
            ui.btnExport.style.opacity = 0.5;
        } else {
            ui.btnExport.disabled = false;
            ui.btnExport.style.opacity = 1;
        }
    }

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
            ui.overlay.style.display = 'flex';

            // Validate Library
            if (!window.jspdf || !window.jspdf.jsPDF) {
                throw new Error("jsPDF library not loaded.");
            }

            const { jsPDF } = window.jspdf;

            // C. Create PDF
            // Init with first page size
            const pdf = new jsPDF({
                orientation: finalImages[0].w > finalImages[0].h ? 'l' : 'p',
                unit: 'px',
                format: [finalImages[0].w, finalImages[0].h]
            });

            for (let i = 0; i < finalImages.length; i++) {
                const img = finalImages[i];

                // Update Progress
                const pct = Math.round(((i + 1) / finalImages.length) * 100);
                ui.pFill.style.width = `${pct}%`;
                ui.sDesc.innerText = `Processing page ${i + 1} of ${finalImages.length}`;

                // Force Repaint
                await new Promise(r => setTimeout(r, 20));

                if (i > 0) {
                    const orientation = img.w > img.h ? 'l' : 'p';
                    pdf.addPage([img.w, img.h], orientation);
                }

                // CRITICAL: Pass 'null' for format to let jsPDF auto-detect
                pdf.addImage(img.data, null, 0, 0, img.w, img.h);
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
};