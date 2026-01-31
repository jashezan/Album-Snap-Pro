// Track the duplicated capture tab
let captureTabId = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "start_capture") {
        // Duplicate the tab and start capture in the duplicate
        startCaptureInDuplicateTab(request.tabId);
    }

    if (request.action === "open_generator") {
        // Open the generator page
        chrome.tabs.create({ url: "generate.html" });

        // Close the duplicated capture tab if it exists
        if (captureTabId !== null) {
            chrome.tabs.remove(captureTabId).catch(() => {
                // Tab may already be closed, ignore error
            });
            captureTabId = null;
        } else if (sender.tab && sender.tab.id) {
            // Fallback: close the sender tab if no tracked capture tab
            chrome.tabs.remove(sender.tab.id).catch(() => { });
        }
    }
});

async function startCaptureInDuplicateTab(originalTabId) {
    try {
        // Duplicate the current tab
        const duplicatedTab = await chrome.tabs.duplicate(originalTabId);
        captureTabId = duplicatedTab.id;

        // Wait for the duplicated tab to finish loading
        await waitForTabLoad(duplicatedTab.id);

        // Inject the content script into the duplicated tab
        await chrome.scripting.executeScript({
            target: { tabId: duplicatedTab.id },
            files: ["content.js"]
        });

    } catch (error) {
        console.error("Error starting capture in duplicate tab:", error);
        captureTabId = null;
    }
}

function waitForTabLoad(tabId) {
    return new Promise((resolve) => {
        const checkTab = async () => {
            try {
                const tab = await chrome.tabs.get(tabId);
                if (tab.status === "complete") {
                    resolve();
                } else {
                    setTimeout(checkTab, 100);
                }
            } catch (e) {
                // Tab might be closed
                resolve();
            }
        };
        checkTab();
    });
}