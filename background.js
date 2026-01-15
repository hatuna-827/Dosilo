chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "Dosilo-bookmark-action",
    title: "ブックマーク一覧を表示",
    contexts: ["action"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "Dosilo-bookmark-action") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("index.html")
    });
  }
});
