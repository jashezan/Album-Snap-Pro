chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "open_generator") {
        chrome.tabs.create({ url: "generate.html" });
    }
});