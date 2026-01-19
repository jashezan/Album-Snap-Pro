document.getElementById("startBtn").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab.url.includes("facebook.com")) {
        // Optional: Check if it's a photo URL to be helpful
        // const isPhoto = tab.url.includes("/photo") || tab.url.includes("fbid=");
        
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]
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