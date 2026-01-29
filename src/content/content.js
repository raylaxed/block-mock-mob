// content.js

// --- State ---
let state = {
    blacklist: [], // Array of { word, action, mock? }
    mobbDictionary: {
        // Simulation of community mocks
        'bad': 'good',
        'evil': 'saintly',
        'hate': 'love'
    }
};

let observer = null;
const BLOCKED_CLASS = 'bmm-blocked';

// --- Initialization ---
console.log('[Block-Mock-Mobb] Content script starting...');

// 1. Inject CSS for blocking
const style = document.createElement('style');
style.textContent = `
  .${BLOCKED_CLASS} {
    display: none !important;
  }
  .bmm-highlight {
      background-color: yellow; /* Debugging/Visual aid if needed, not used yet */
  }
`;
document.head.appendChild(style);

// 2. Load Config & Start
// Load settings (sync) and dictionary (local)
chrome.storage.sync.get(['blacklist'], (syncResult) => {
    chrome.storage.local.get(['mobbDictionary'], (localResult) => {

        const combinedState = {
            ...syncResult,
            ...localResult
        };

        updateState(combinedState);
        runScan();
        setupObserver();
    });
});

// 3. Listen for changes
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
        // User settings changed
        const newState = {};
        if (changes.blacklist) newState.blacklist = changes.blacklist.newValue;

        updateState(newState);

        if (changes.blacklist) {
            unblockAll();
            runScan();
        }
    } else if (area === 'local') {
        // Dictionary updated by background script
        if (changes.mobbDictionary) {
            console.log('[Content] Dictionary updated');
            updateState({ mobbDictionary: changes.mobbDictionary.newValue });
            // Re-scan to apply new community mocks
            runScan();
        }
    }
});


// --- Core Logic ---

function updateState(newState) {
    state = { ...state, ...newState };
    console.log('[Block-Mock-Mobb] State updated:', state);
}

function unblockAll() {
    const blockedElements = document.querySelectorAll(`.${BLOCKED_CLASS}`);
    blockedElements.forEach(el => el.classList.remove(BLOCKED_CLASS));
}

function runScan(rootNode = document.body) {
    // If no blacklist or empty, just return
    // (Wait, even if blacklist is empty, unblockAll handles cleanup)
    if (!state.blacklist || state.blacklist.length === 0) return;

    const walker = document.createTreeWalker(
        rootNode,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                // Skip script/style tags and already processed nodes
                if (node.parentElement && ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName)) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (node.textContent.trim() === '') {
                    return NodeFilter.FILTER_SKIP;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const nodesToProcess = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
        nodesToProcess.push(currentNode);
        currentNode = walker.nextNode();
    }

    // Process after walking to avoid messing up the walker structure with replacements
    nodesToProcess.forEach(processNode);
}

function processNode(textNode) {
    const text = textNode.textContent;
    let newText = text;
    let shouldBlock = false;
    const lowerText = text.toLowerCase();

    // Check blacklist
    if (!state.blacklist || !Array.isArray(state.blacklist)) return;

    for (const item of state.blacklist) {
        if (!item) continue;

        // Normalize item structure (handle legacy migration on the fly if needed, 
        // though popup really should handle it. Being safe here.)
        let word, action, mock;

        if (typeof item === 'string') {
            word = item;
            action = 'block'; // Default legacy behavior
        } else {
            word = item.word;
            // If action missing but mock present -> mock, else block
            action = item.action || (item.mock ? 'mock' : 'block');
            mock = item.mock;
        }

        if (!word) continue;

        if (lowerText.includes(word.toLowerCase())) {

            if (action === 'block') {
                shouldBlock = true;
                break; // Priority: if blocked, no need to mock
            } else if (action === 'mock') {
                const regex = new RegExp(escapeRegExp(word), 'gi');
                const replacement = mock || '****'; // Fallback if mock is missing for some reason
                newText = newText.replace(regex, replacement);
            } else if (action === 'mobb') {
                const regex = new RegExp(escapeRegExp(word), 'gi');
                // Community -> Custom Fallback -> Universal Fallback
                const replacement = state.mobbDictionary[word.toLowerCase()] || mock || '****';
                newText = newText.replace(regex, replacement);
            }
        }
    }

    // Apply Actions
    if (shouldBlock) {
        if (textNode.parentElement) {
            textNode.parentElement.classList.add(BLOCKED_CLASS);
        }
    } else if (newText !== text) {
        textNode.textContent = newText;
    }
}

// --- Utils ---

let timeoutId = null;

function setupObserver() {
    observer = new MutationObserver((mutations) => {
        let shouldScan = false;

        // Simple optimization: If *any* relevant mutation happens, we schedule a scan.
        // We won't try to be too smart about specific subtrees because complex SPAs 
        // like YouTube recycle elements or update text in deep nodes.
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                shouldScan = true;
                break;
            }
            if (mutation.type === 'characterData') {
                shouldScan = true;
                break;
            }
        }

        if (shouldScan) {
            // Debounce the scan
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                // For SPAs like YouTube, a full body scan is safest to catch everything 
                // without getting lost in specific subtrees that might have moved.
                // It's reasonably fast on modern engines.
                runScan(document.body);
            }, 500); // 500ms delay to let the UI settle
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true // Important for text updates in existing nodes
    });
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
