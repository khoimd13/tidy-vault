/** Thin wrappers around extension APIs used by the UI, so screens stay simple. */
import type { PanelResponse, PanelToContent } from '../../shared/messages';

export const PHOTOS_ORIGIN = 'https://photos.google.com/';

/** The active tab, if it is Google Photos. Tab URLs are only visible for our host permission. */
export async function findPhotosTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id !== undefined && tab.url?.startsWith(PHOTOS_ORIGIN) ? tab.id : null;
}

export async function sendToTab(tabId: number, msg: PanelToContent): Promise<PanelResponse> {
  return chrome.tabs.sendMessage<PanelToContent, PanelResponse>(tabId, msg);
}

export async function openGooglePhotos(): Promise<void> {
  await chrome.tabs.create({ url: PHOTOS_ORIGIN });
}

export async function getFlag(key: string): Promise<boolean> {
  const stored: Record<string, unknown> = await chrome.storage.local.get(key);
  return stored[key] === true;
}

export async function setFlag(key: string, value: boolean): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}
