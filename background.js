chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getCurrentTabId") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            sendResponse({ tab: tabs?.[0] });
        });
        return true; // Indicate that the response will be sent asynchronously
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "removeTab") {
        chrome.tabs.remove(sender.tab.id, () => {
            sendResponse({ success: true });
        });
        return true;
    }
});
