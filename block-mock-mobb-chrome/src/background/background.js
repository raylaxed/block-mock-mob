// background.js
// Service worker for background tasks and "Mobb" dictionary sync

console.log('Block-Mock-Mobb background service worker active');

const DICTIONARY_API_URL = 'https://mobbit-db.vercel.app/api/dictionary';
// Refresh every hour (milliseconds)
const REFRESH_INTERVAL = 60 * 60 * 1000;

// Initialize
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed/updated. Fetching initial dictionary...');
    fetchAndSaveDictionary();
});

// Alarm for periodic updates
chrome.alarms.create('refreshDictionary', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'refreshDictionary') {
        fetchAndSaveDictionary();
    }
});

async function fetchAndSaveDictionary() {
    try {
        const response = await fetch(DICTIONARY_API_URL);
        if (!response.ok) throw new Error(`Status ${response.status}`);

        const dictionary = await response.json();

        if (dictionary && typeof dictionary === 'object') {
            chrome.storage.local.set({ mobbDictionary: dictionary }, () => {
                console.log('[Mobb] Dictionary updated via background fetch.', Object.keys(dictionary).length, 'entries');
            });
        }
    } catch (err) {
        console.error('[Mobb] Failed to fetch dictionary:', err);
    }
}
