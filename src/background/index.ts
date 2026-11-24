/**
 * Service worker: opens the side panel from the toolbar icon, and runs the optional monthly
 * reminder (a small count on the icon when photos are waiting to be reviewed).
 */
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err: unknown) => {
  console.error('Vault Tidy: could not set side panel behaviour', err);
});

const ALARM = 'vault-tidy-monthly-reminder';
const MONTH_MINUTES = 30 * 24 * 60;

function ensureAlarm(): void {
  void chrome.alarms.get(ALARM).then((existing) => {
    if (!existing) void chrome.alarms.create(ALARM, { periodInMinutes: MONTH_MINUTES });
  });
}

chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM) return;
  void chrome.storage.local
    .get(['reminder', 'pendingCount'])
    .then(async (stored: Record<string, unknown>) => {
      const count = typeof stored.pendingCount === 'number' ? stored.pendingCount : 0;
      if (stored.reminder !== true || count <= 0) return;
      await chrome.action.setBadgeBackgroundColor({ color: '#B9A4FF' });
      await chrome.action.setBadgeTextColor?.({ color: '#1A1530' });
      await chrome.action.setBadgeText({ text: count > 99 ? '99+' : String(count) });
    });
});
