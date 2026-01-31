(async function () {
    if (window.fbScraperRunning) return;
    window.fbScraperRunning = true;

    // === 1. INJECT PRO STYLES ===
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes pulse-blue { 0% { box-shadow: 0 0 0 0 rgba(24, 119, 242, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(24, 119, 242, 0); } 100% { box-shadow: 0 0 0 0 rgba(24, 119, 242, 0); } }
        @keyframes scan-line { 0% { top: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        
        .fb-pdf-glass {
            position: fixed; bottom: 30px; right: 30px; z-index: 999999;
            background: rgba(20, 25, 30, 0.9); backdrop-filter: blur(16px);
            color: white; padding: 24px; border-radius: 16px; width: 300px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4); 
            border: 1px solid rgba(255, 255, 255, 0.1);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .title { font-weight: 700; font-size: 17px; color: #fff; letter-spacing: -0.5px; }
        
        .status-badge {
            background: rgba(24, 119, 242, 0.2); color: #4ba3ff; 
            padding: 5px 12px; border-radius: 20px; font-size: 11px; 
            font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
            border: 1px solid rgba(24, 119, 242, 0.3);
            display: flex; align-items: center; gap: 8px;
        }
        .status-dot { width: 8px; height: 8px; background: #1877f2; border-radius: 50%; animation: pulse-blue 2s infinite; }

        .preview-container {
            position: relative; width: 100%; height: 180px; 
            background: #0f1115; border-radius: 12px; overflow: hidden;
            margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.05);
            box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
        }
        .live-preview {
            width: 100%; height: 100%; object-fit: contain; opacity: 0.9;
        }
        .scanner-overlay {
            position: absolute; left: 0; right: 0; height: 2px; background: #1877f2;
            box-shadow: 0 0 15px #1877f2, 0 0 30px #1877f2;
            animation: scan-line 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            opacity: 0.8;
        }

        .info-row { display: flex; justify-content: space-between; font-size: 13px; color: #9ca3af; margin-bottom: 8px; }
        .info-val { color: #fff; font-weight: 600; font-feature-settings: "tnum"; }
        
        .progress-text { 
            font-size: 12px; color: #6b7280; margin: 20px 0 15px 0; text-align: center; 
            background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px;
        }

        .btn-stop {
            width: 100%; padding: 12px; 
            background: rgba(239, 68, 68, 0.1); color: #ef4444; 
            border: 1px solid rgba(239, 68, 68, 0.2); 
            border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;
            transition: all 0.2s;
        }
        .btn-stop:hover { background: rgba(239, 68, 68, 0.2); border-color: #ef4444; transform: translateY(-1px); }
    `;
    document.head.appendChild(style);

    // === 2. CREATE GUI ===
    const gui = document.createElement('div');
    gui.className = 'fb-pdf-glass';
    gui.innerHTML = `
        <div class="header-row">
            <div class="title">Album Scanner</div>
            <div class="status-badge"><div class="status-dot"></div> ACTIVE</div>
        </div>

        <div class="preview-container">
            <div class="scanner-overlay"></div>
            <img id="fb-preview" class="live-preview" src="">
        </div>

        <div class="info-row">
            <span>Images Captured</span>
            <span id="fb-count" class="info-val">0</span>
        </div>
        <div class="info-row">
            <span>Current Status</span>
            <span id="fb-status" class="info-val" style="color:#60a5fa">Initializing...</span>
        </div>

        <div class="progress-text">
            ⚡ Safe Mode: Human-like delays to protect your account.
        </div>

        <button id="fb-stop" class="btn-stop">Stop & Create PDF Now</button>
    `;
    document.body.appendChild(gui);

    const previewImg = document.getElementById('fb-preview');
    const updateUI = (msg, count, lastImgData) => {
        document.getElementById('fb-status').innerText = msg;
        if (count !== undefined) document.getElementById('fb-count').innerText = count;

        if (lastImgData) {
            previewImg.src = lastImgData;
        }
    };

    let isScanning = true;
    document.getElementById('fb-stop').onclick = () => {
        if (confirm("Stop scanning early and generate PDF with current images?")) {
            isScanning = false;
        }
    };

    // === LOGIC ===
    const delay = ms => new Promise(r => setTimeout(r, ms));

    // === RATE LIMITING CONFIG ===
    // Balanced delays - fast but with some randomness to avoid detection
    const RATE_LIMIT = {
        minDelay: 400,           // Minimum delay between photos (ms)
        maxDelay: 900,           // Maximum delay between photos (ms)
        pauseEvery: 30,          // Pause after every N photos
        pauseDuration: 2000,     // How long to pause (ms)
        pauseJitter: 1500        // Random extra pause time (ms)
    };

    // Get a random delay within range for human-like behavior
    const getRandomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    // Human-like delay with jitter
    const humanDelay = () => delay(getRandomDelay(RATE_LIMIT.minDelay, RATE_LIMIT.maxDelay));

    const seenFbids = new Set();
    const seenImageUrls = new Set(); // Track actual image URLs for duplicate detection
    const capturedImages = [];
    let startFbid = null;
    let lastImageUrl = null;
    let consecutiveDuplicateCount = 0;
    const MAX_CONSECUTIVE_DUPLICATES = 3; // If same image appears 3x in a row, we've looped

    const getCurrentFbid = () => new URLSearchParams(window.location.search).get("fbid");
    const getNextButton = () => document.querySelector('div[aria-label="Next photo"]') || document.querySelector('div[aria-label="Next"]');

    const getActiveImage = () => {
        const allImages = Array.from(document.querySelectorAll('img'));
        const contentImages = allImages.filter(img => img.getBoundingClientRect().width > 300);
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        let bestImg = null, minDist = Infinity;
        for (const img of contentImages) {
            const rect = img.getBoundingClientRect();
            const dist = Math.hypot((rect.left + rect.width / 2) - centerX, (rect.top + rect.height / 2) - centerY);
            if (dist < minDist) { minDist = dist; bestImg = img; }
        }
        return bestImg;
    };

    // Extract a normalized URL for comparison (strips query params that might change)
    const normalizeImageUrl = (url) => {
        try {
            const u = new URL(url);
            // Keep the path as the main identifier, ignore varying CDN params
            return u.pathname;
        } catch (e) { return url; }
    };

    const urlToBase64 = async (url) => {
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            return new Promise(resolve => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        } catch (e) { return null; }
    };

    // === MAIN LOOP ===
    updateUI("Scanning page...", 0);
    await delay(1000);
    let loopSafety = 0;

    while (isScanning) {
        loopSafety++;
        if (loopSafety > 1000) {
            updateUI("Safety limit reached", capturedImages.length);
            break;
        }

        const fbid = getCurrentFbid();

        // Check if we've looped back to the start (fbid-based detection)
        if (startFbid && fbid === startFbid && capturedImages.length > 0) {
            updateUI("Loop detected (start reached)", capturedImages.length);
            break;
        }
        if (!startFbid && fbid) startFbid = fbid;

        const imgEl = getActiveImage();
        if (imgEl && imgEl.src) {
            const normalizedUrl = normalizeImageUrl(imgEl.src);

            // Check for consecutive duplicates (loop detection)
            if (normalizedUrl === lastImageUrl) {
                consecutiveDuplicateCount++;
                if (consecutiveDuplicateCount >= MAX_CONSECUTIVE_DUPLICATES) {
                    updateUI("Loop detected (same image)", capturedImages.length);
                    break;
                }
            } else {
                consecutiveDuplicateCount = 0;
                lastImageUrl = normalizedUrl;
            }

            // Only capture if we haven't seen this image before
            if (!seenImageUrls.has(normalizedUrl)) {
                updateUI("Fetching High-Res...", capturedImages.length);

                const base64Data = await urlToBase64(imgEl.src);
                if (base64Data) {
                    seenImageUrls.add(normalizedUrl);
                    if (fbid) seenFbids.add(fbid);
                    capturedImages.push({ data: base64Data, w: imgEl.naturalWidth, h: imgEl.naturalHeight });
                    updateUI("Processing...", capturedImages.length, base64Data);
                }
            }
        }

        // Check for "Next" button - if missing, we've reached the end
        const nextBtn = getNextButton();
        if (!nextBtn) {
            updateUI("End of album reached", capturedImages.length);
            break;
        }

        // === RATE LIMITING: Periodic pause to look more human ===
        if (capturedImages.length > 0 && capturedImages.length % RATE_LIMIT.pauseEvery === 0) {
            const pauseTime = RATE_LIMIT.pauseDuration + getRandomDelay(0, RATE_LIMIT.pauseJitter);
            updateUI(`Cooling down... (${Math.round(pauseTime / 1000)}s)`, capturedImages.length);
            await delay(pauseTime);
        }

        // Human-like delay before clicking next
        await humanDelay();

        nextBtn.click();

        // Wait for navigation with timeout
        let navigated = false;
        const prevFbid = fbid;
        const prevImgUrl = imgEl ? normalizeImageUrl(imgEl.src) : null;

        for (let i = 0; i < 15; i++) {
            await delay(400 + getRandomDelay(0, 200));  // Slight randomness in wait time

            const newFbid = getCurrentFbid();
            const newImgEl = getActiveImage();
            const newImgUrl = newImgEl ? normalizeImageUrl(newImgEl.src) : null;

            // Check if either fbid or image URL changed
            if (newFbid !== prevFbid || (newImgUrl && newImgUrl !== prevImgUrl)) {
                navigated = true;
                break;
            }

            // Retry click after some attempts
            if (i === 5 && isScanning) nextBtn.click();
        }

        // If navigation didn't happen after all retries, we've likely reached the end
        if (!navigated) {
            updateUI("Navigation stalled - end of album", capturedImages.length);
            break;
        }
    }

    // === HANDOFF ===
    updateUI("Saving Data...", capturedImages.length);
    document.querySelector('.scanner-overlay').style.display = 'none';
    document.querySelector('.status-badge').style.background = '#374151';
    document.querySelector('.status-badge').innerText = "COMPLETE";

    await chrome.storage.local.set({ "fb_pdf_data": capturedImages });

    updateUI("Launching Dashboard...", capturedImages.length);
    try { await chrome.runtime.sendMessage({ action: "open_generator" }); } catch (e) { }

    setTimeout(() => { gui.remove(); window.fbScraperRunning = false; }, 2000);
})();