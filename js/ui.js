// UI Module - Handles UI interactions and navigation

import { loadAnswerKeys, updateAnswerKeySelect } from './answer-key.js';
import { getCurrentImage } from './camera.js';
import { loadOpenCV, detectBubblesAdvanced, getLastDebugCanvas, getLastInfo } from './omr.js';
import { gradeAnswers, saveGradingResult, getGradeLetter, getPercentageColor, getPercentageBgColor } from './grading.js';
import { storage, settings } from './storage.js';

// Export functions for use in app.js
export { loadAnswerKeys, updateAnswerKeySelect };

// Tab navigation
export function showTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('[id^="tab-"]').forEach(tab => {
        tab.classList.remove('tab-active');
    });
    
    // Show selected tab content
    document.getElementById(`content-${tabName}`).classList.remove('hidden');
    
    // Add active class to selected tab
    document.getElementById(`tab-${tabName}`).classList.add('tab-active');
    
    // Load content based on tab
    if (tabName === 'answer-keys') {
        loadAnswerKeys();
    } else if (tabName === 'grade-sheet') {
        updateAnswerKeySelect();
    } else if (tabName === 'history') {
        loadHistory();
    } else if (tabName === 'settings') {
        loadSettings();
    }
}

window.showTab = showTab;

// Grade sheet
export function gradeSheet() {
    const keyId = document.getElementById('grade-key-select').value;
    const imageFile = getCurrentImage();
    
    if (!keyId) {
        alert('Please select an answer key');
        return;
    }
    
    if (!imageFile) {
        alert('Please upload or capture an answer sheet image');
        return;
    }
    
    showLoading('Loading OpenCV and processing image...');
    
    loadOpenCV().then(() => {
        console.log('OpenCV loaded successfully');
        showLoading('Detecting bubbles...');
        
        // Get answer key
        return storage.getAnswerKey(keyId);
    }).then(answerKey => {
        console.log('Answer key loaded:', answerKey);
        // Create image element for OpenCV
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = URL.createObjectURL(imageFile);
        
        return new Promise((resolve, reject) => {
            img.onload = () => {
                console.log('Image loaded successfully');
                resolve({ img, answerKey });
            };
            img.onerror = (error) => {
                console.error('Image load error:', error);
                reject(new Error('Failed to load image'));
            };
        });
    }).then(({ img, answerKey }) => {
        showLoading('Detecting bubbles...');
        
        // Detect bubbles
        return settings.get().then(currentSettings => {
            console.log('Settings loaded, threshold:', currentSettings.threshold);
            try {
                const detectedAnswers = detectBubblesAdvanced(img, currentSettings.threshold);
                console.log('Bubbles detected:', detectedAnswers);
                return { img, answerKey, detectedAnswers };
            } catch (error) {
                console.error('Bubble detection error:', error);
                throw error;
            }
        });
    }).then(({ img, answerKey, detectedAnswers }) => {
        showLoading('Grading answers...');
        
        // Grade answers
        const result = gradeAnswers(detectedAnswers, answerKey);
        console.log('Grading result:', result);
        
        // Create thumbnail
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 200;
        canvas.height = 200 * (img.height / img.width);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        
        // Save result
        return saveGradingResult(keyId, result, thumbnail).then(() => {
            return { result, answerKey };
        });
    }).then(({ result, answerKey }) => {
        // Display results
        displayResults(result, answerKey);
        appendDebugView();
        hideLoading();
    }).catch(error => {
        console.error('Grading error:', error);
        hideLoading();
        alert('Error during grading: ' + error.message + '\n\nPlease try again with a clearer image.');
    });
}

window.gradeSheet = gradeSheet;

// Display grading results
function displayResults(result, answerKey) {
    const resultsSection = document.getElementById('results-section');
    const resultsContent = document.getElementById('results-content');
    
    const gradeLetter = getGradeLetter(result.percentage);
    const percentageColor = getPercentageColor(result.percentage);
    const bgColor = getPercentageBgColor(result.percentage);
    
    resultsContent.innerHTML = `
        <div class="grid md:grid-cols-3 gap-6 mb-6">
            <div class="text-center p-6 ${bgColor} rounded-lg">
                <div class="text-4xl font-bold ${percentageColor}">${result.score}/${result.total}</div>
                <div class="text-sm text-gray-600 mt-1">Score</div>
            </div>
            <div class="text-center p-6 ${bgColor} rounded-lg">
                <div class="text-4xl font-bold ${percentageColor}">${result.percentage}%</div>
                <div class="text-sm text-gray-600 mt-1">Percentage</div>
            </div>
            <div class="text-center p-6 ${bgColor} rounded-lg">
                <div class="text-4xl font-bold ${percentageColor}">${gradeLetter}</div>
                <div class="text-sm text-gray-600 mt-1">Grade</div>
            </div>
        </div>
        
        <div class="grid md:grid-cols-2 gap-6">
            <div>
                <h3 class="font-semibold text-gray-800 mb-3">Incorrect Answers (${result.wrongItems.length})</h3>
                ${result.wrongItems.length > 0 ? `
                    <div class="flex flex-wrap gap-2">
                        ${result.wrongItems.map(item => `
                            <span class="inline-flex items-center justify-center w-8 h-8 text-sm font-medium bg-red-100 text-red-800 rounded-full">${item}</span>
                        `).join('')}
                    </div>
                ` : '<p class="text-gray-500">None! Great job!</p>'}
            </div>
            <div>
                <h3 class="font-semibold text-gray-800 mb-3">Blank Answers (${result.blankItems.length})</h3>
                ${result.blankItems.length > 0 ? `
                    <div class="flex flex-wrap gap-2">
                        ${result.blankItems.map(item => `
                            <span class="inline-flex items-center justify-center w-8 h-8 text-sm font-medium bg-gray-100 text-gray-800 rounded-full">${item}</span>
                        `).join('')}
                    </div>
                ` : '<p class="text-gray-500">None</p>'}
            </div>
        </div>
        
        <div class="mt-6">
            <h3 class="font-semibold text-gray-800 mb-3">Detailed Breakdown</h3>
            <div class="grid gap-2 max-h-64 overflow-y-auto">
                ${result.keyAnswers.map((keyAnswer, index) => {
                    const detected = result.answersDetected[index];
                    const isCorrect = detected === keyAnswer;
                    const isBlank = detected === null || detected === undefined;
                    
                    return `
                        <div class="flex items-center gap-3 p-2 rounded ${isCorrect ? 'bg-green-50' : isBlank ? 'bg-gray-50' : 'bg-red-50'}">
                            <span class="w-8 text-center font-medium text-gray-600">${index + 1}</span>
                            <span class="flex-1">
                                <span class="font-medium">Key: ${keyAnswer}</span>
                                ${isBlank ? '<span class="text-gray-400 ml-2">(blank)</span>' : `<span class="ml-2 ${isCorrect ? 'text-green-600' : 'text-red-600'}">Detected: ${detected || '-'}</span>`}
                            </span>
                            ${isCorrect ? '<i data-lucide="check" class="w-4 h-4 text-green-600"></i>' : '<i data-lucide="x" class="w-4 h-4 text-red-600"></i>'}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    resultsSection.classList.remove('hidden');
    
    // Re-initialize Lucide icons
    lucide.createIcons();
}

// Show what the reader saw (green = shaded, red = multiple, grey = empty, orange = estimated)
function appendDebugView() {
    const canvas = getLastDebugCanvas();
    if (!canvas) return;
    const info = getLastInfo();
    const wrap = document.createElement('div');
    wrap.className = 'mt-6';
    wrap.innerHTML = `
        <h3 class="font-semibold text-gray-800 mb-1">What the reader saw</h3>
        <p class="text-sm text-gray-500 mb-2">Green = shaded, red = more than one shaded, grey = empty, orange = estimated position.
        Blue numbers are item numbers - check they match your sheet.${info ? ` (bubbles found: ${info.detected}/250${info.upsideDown ? ', sheet was upside-down' : ''})` : ''}</p>`;
    canvas.className = 'max-w-full rounded-lg border border-gray-200';
    wrap.appendChild(canvas);
    document.getElementById('results-content').appendChild(wrap);
}

// Load grading history
export function loadHistory() {
    storage.getResults().then(results => {
        const historyList = document.getElementById('history-list');
        const noHistoryMessage = document.getElementById('no-history-message');
        const filterSelect = document.getElementById('history-filter');
        
        // Update filter options
        const subjects = [...new Set(results.map(r => r.subject))];
        filterSelect.innerHTML = '<option value="all">All Subjects</option>' +
            subjects.map(s => `<option value="${s}">${s}</option>`).join('');
        
        // Filter results
        const filter = filterSelect.value;
        const filteredResults = filter === 'all' ? results : results.filter(r => r.subject === filter);
        
        // Sort by timestamp (newest first)
        filteredResults.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        if (filteredResults.length === 0) {
            historyList.innerHTML = '';
            noHistoryMessage.classList.remove('hidden');
            return;
        }
        
        noHistoryMessage.classList.add('hidden');
        
        historyList.innerHTML = filteredResults.map(result => {
            const gradeLetter = getGradeLetter(result.percentage);
            const percentageColor = getPercentageColor(result.percentage);
            
            return `
                <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <h3 class="font-semibold text-gray-800">${result.subject}</h3>
                            <p class="text-sm text-gray-500">${new Date(result.timestamp).toLocaleString()}</p>
                        </div>
                        <div class="text-right">
                            <div class="text-2xl font-bold ${percentageColor}">${result.score}/${result.total}</div>
                            <div class="text-sm text-gray-600">${result.percentage}% (${gradeLetter})</div>
                        </div>
                    </div>
                    <div class="mt-3 flex gap-2">
                        <button data-action="view-result-detail" data-id="${result.id}" class="text-blue-600 hover:text-blue-800 text-sm">
                            <i data-lucide="eye" class="w-4 h-4 inline mr-1"></i>View Details
                        </button>
                        <button data-action="delete-result" data-id="${result.id}" class="text-red-600 hover:text-red-800 text-sm">
                            <i data-lucide="trash-2" class="w-4 h-4 inline mr-1"></i>Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Re-initialize Lucide icons
        lucide.createIcons();
    });
}

// View result detail
export function viewResultDetail(id) {
    storage.getResults().then(results => {
        const result = results.find(r => r.id === id);
        
        if (!result) return;
        
        return storage.getAnswerKey(result.keyId).then(answerKey => {
            // Show in a modal or navigate to results
            // For now, we'll reuse the results display
            displayResults(result, answerKey);
            
            // Switch to grade sheet tab to show results
            showTab('grade-sheet');
        });
    });
}

window.viewResultDetail = viewResultDetail;

// Delete result
export function deleteResult(id) {
    if (!confirm('Are you sure you want to delete this result?')) return;
    
    storage.deleteResult(id).then(() => {
        loadHistory();
    });
}

window.deleteResult = deleteResult;

// Export history
export function exportHistory() {
    storage.getResults().then(results => {
        if (results.length === 0) {
            alert('No results to export');
            return;
        }
        
        // Create CSV
        const headers = ['Subject', 'Date', 'Score', 'Total', 'Percentage', 'Wrong Items', 'Blank Items'];
        const rows = results.map(r => [
            r.subject,
            new Date(r.timestamp).toLocaleString(),
            r.score,
            r.total,
            r.percentage,
            r.wrongItems.join(';'),
            r.blankItems.join(';')
        ]);
        
        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        
        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `grading-history-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

window.exportHistory = exportHistory;

// Load settings
export function loadSettings() {
    settings.get().then(currentSettings => {
        document.getElementById('threshold-slider').value = currentSettings.threshold;
        document.getElementById('threshold-value').textContent = currentSettings.threshold;
        document.getElementById('max-options').value = currentSettings.maxOptions;
    });
}

// Update threshold
export function updateThreshold() {
    const value = document.getElementById('threshold-slider').value;
    document.getElementById('threshold-value').textContent = value;
    settings.update('threshold', parseInt(value));
}

window.updateThreshold = updateThreshold;

// Clear all data
export function clearAllData() {
    if (!confirm('Are you sure you want to delete ALL data? This cannot be undone.')) return;
    if (!confirm('This will delete all answer keys and grading history. Continue?')) return;
    
    storage.clearAllData().then(() => {
        alert('All data has been cleared');
        loadAnswerKeys();
    });
}

window.clearAllData = clearAllData;

// Loading overlay
function showLoading(text = 'Processing...') {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    
    loadingText.textContent = text;
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
}