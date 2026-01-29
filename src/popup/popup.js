document.addEventListener('DOMContentLoaded', () => {
    // --- element references ---
    const wordInput = document.getElementById('word-input');
    const actionSelect = document.getElementById('action-select');
    const mockWordInput = document.getElementById('mock-word-input');
    const addBtn = document.getElementById('add-btn');
    const blacklistList = document.getElementById('blacklist-list');

    // recommendation
    const recommendInput = document.getElementById('recommend-input');
    const recommendMockInput = document.getElementById('recommend-mock-input');
    const recommendBtn = document.getElementById('recommend-btn');

    // --- state ---
    let currentSettings = {
        blacklist: [], // Array of { word, action: 'block'|'mock'|'mobb', mock?: string }
        mobbRecommendations: []
    };

    // --- initialization ---
    loadSettings();

    // --- event listeners ---

    // toggle mock input
    actionSelect.addEventListener('change', () => {
        const action = actionSelect.value;
        if (action === 'mock' || action === 'mobb') {
            mockWordInput.style.display = 'block';
            mockWordInput.focus();
        } else {
            mockWordInput.style.display = 'none';
            mockWordInput.value = ''; // Clear it
        }
    });

    // Add item
    addBtn.addEventListener('click', addBlacklistItem);
    wordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addBlacklistItem(); });
    mockWordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addBlacklistItem(); });

    // Recommend
    recommendBtn.addEventListener('click', sendRecommendation);
    recommendInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendRecommendation(); });
    recommendMockInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendRecommendation(); });

    // --- functions ---

    function loadSettings() {
        chrome.storage.sync.get(['blacklist', 'mobbRecommendations'], (result) => {
            if (result.blacklist) {
                // Migrate old string data or old object data to new format if needed
                currentSettings.blacklist = result.blacklist.map(item => {
                    if (typeof item === 'string') return { word: item, action: 'block' }; // Default legacy to block
                    if (!item.action) {
                        // Old object format { word, mock? }
                        return {
                            word: item.word,
                            action: item.mock ? 'mock' : 'block',
                            mock: item.mock
                        };
                    }
                    return item;
                });
            }
            if (result.mobbRecommendations) currentSettings.mobbRecommendations = result.mobbRecommendations;

            renderBlacklist();
        });
    }

    function saveSettingsToStorage() {
        chrome.storage.sync.set({
            blacklist: currentSettings.blacklist
        }, () => {
            console.log('Settings saved');
        });
    }

    function renderBlacklist() {
        blacklistList.innerHTML = '';

        const count = currentSettings.blacklist.length;
        const countBadge = document.getElementById('rule-count');
        if (countBadge) countBadge.textContent = `${count} rule${count !== 1 ? 's' : ''}`;

        currentSettings.blacklist.forEach((item, index) => {
            const li = document.createElement('li');

            // Left side
            const infoDiv = document.createElement('div');
            infoDiv.className = 'item-info';

            const wordSpan = document.createElement('span');
            wordSpan.className = 'item-word';
            wordSpan.textContent = item.word;
            infoDiv.appendChild(wordSpan);

            const badge = document.createElement('span');
            badge.className = 'badge';

            if (item.action === 'block') {
                badge.classList.add('badge-block');
                badge.textContent = 'Block';
                infoDiv.appendChild(badge);
            } else if (item.action === 'mock') {
                badge.classList.add('badge-mock');
                badge.textContent = 'Mock';
                infoDiv.appendChild(badge);

                const arrow = document.createElement('span');
                arrow.className = 'mock-arrow';
                arrow.textContent = '→';
                infoDiv.appendChild(arrow);

                const target = document.createElement('span');
                target.className = 'mock-target';
                target.textContent = item.mock;
                infoDiv.appendChild(target);
            } else if (item.action === 'mobb') {
                badge.classList.add('badge-mobb');
                badge.textContent = 'Mobb';
                infoDiv.appendChild(badge);

                if (item.mock) {
                    const arrow = document.createElement('span');
                    arrow.className = 'mock-arrow';
                    arrow.textContent = '→';
                    infoDiv.appendChild(arrow);

                    const target = document.createElement('span');
                    target.className = 'mock-target';
                    target.textContent = item.mock;
                    infoDiv.appendChild(target);
                }
            }

            li.appendChild(infoDiv);

            // Right side
            const delBtn = document.createElement('button');
            delBtn.innerHTML = '&times;';
            delBtn.className = 'delete-btn';
            delBtn.title = 'Remove rule';
            delBtn.onclick = () => removeBlacklistItem(index);

            li.appendChild(delBtn);
            blacklistList.appendChild(li);
        });
    }

    function addBlacklistItem() {
        const word = wordInput.value.trim();
        const action = actionSelect.value;
        const mockValue = mockWordInput.value.trim();

        if (!word) {
            wordInput.focus();
            return;
        }

        const existsIndex = currentSettings.blacklist.findIndex(i =>
            (typeof i === 'string' ? i : i.word).toLowerCase() === word.toLowerCase()
        );

        const newItem = {
            word: word,
            action: action
        };

        if (action === 'mock' || action === 'mobb') {
            if (action === 'mock' && !mockValue) {
                mockWordInput.placeholder = "Required!";
                mockWordInput.focus();
                return;
            }
            if (mockValue) {
                newItem.mock = mockValue;
            }
        }

        console.log('[Popup] Adding item:', newItem);

        if (existsIndex >= 0) {
            currentSettings.blacklist[existsIndex] = newItem;
        } else {
            currentSettings.blacklist.push(newItem);
        }

        // Clear UI
        wordInput.value = '';
        mockWordInput.value = '';
        wordInput.focus();

        renderBlacklist();
        saveSettingsToStorage();
    }

    function removeBlacklistItem(index) {
        currentSettings.blacklist.splice(index, 1);
        renderBlacklist();
        saveSettingsToStorage();
    }

    async function sendRecommendation() {
        const word = recommendInput.value.trim();
        const mock = recommendMockInput.value.trim();

        console.log('[Popup] Recommendation Input - Word:', word, 'Mock:', mock);

        if (word) {
            const originalBtnText = recommendBtn.textContent;
            recommendBtn.textContent = 'Sending...';
            recommendBtn.disabled = true;

            const payload = { word, mock };
            console.log('[Popup] Sending payload:', payload);

            try {
                const response = await fetch('https://mobbit-db.vercel.app/api/recommend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    currentSettings.mobbRecommendations.push({
                        word,
                        mock,
                        timestamp: Date.now(),
                        synced: true
                    });
                    chrome.storage.sync.set({ mobbRecommendations: currentSettings.mobbRecommendations }, () => {
                        recommendInput.value = '';
                        recommendMockInput.value = '';
                        recommendBtn.textContent = 'Sent!';
                    });
                } else {
                    console.error('API Error:', await response.text());
                    recommendBtn.textContent = 'Error';
                }
            } catch (err) {
                console.error('Network Error:', err);
                recommendBtn.textContent = 'Net Error';
            } finally {
                setTimeout(() => {
                    recommendBtn.textContent = 'Send';
                    recommendBtn.disabled = false;
                }, 2000);
            }
        }
    }

});
