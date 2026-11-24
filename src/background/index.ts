/** Service worker: open the side panel when the toolbar icon is clicked. */
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err: unknown) => {
  console.error('Vault Tidy: could not set side panel behaviour', err);
});
