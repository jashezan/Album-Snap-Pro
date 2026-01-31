document.getElementById("startBtn").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab.url.includes("facebook.com")) {
        // Send message to background to duplicate tab and start capture
        chrome.runtime.sendMessage({
            action: "start_capture",
            tabId: tab.id
        });
        window.close();
    } else {
        const btn = document.getElementById("startBtn");
        btn.innerText = "Go to Facebook First";
        btn.style.background = "#ef4444";
        setTimeout(() => {
            btn.innerText = "✨ Initialize Scanner";
            btn.style.background = "";
        }, 2000);
    }
});