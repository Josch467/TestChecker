// Answer Key Module - Handles answer key creation, editing, and management

import { storage } from './storage.js';

let currentEditingKey = null;
let currentAnswers = new Array(50).fill(null);

// Generate answer grid in modal
export function generateAnswerGrid() {
    const grid = document.getElementById('answer-grid');
    grid.innerHTML = '';
    
    const maxOptions = 5; // A-E
    
    for (let i = 0; i < 50; i++) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center gap-4 p-3 bg-gray-50 rounded-lg';
        itemDiv.innerHTML = `
            <div class="w-8 text-center font-medium text-gray-700">${i + 1}</div>
            <div class="flex gap-2 flex-1">
                ${['A', 'B', 'C', 'D', 'E'].slice(0, maxOptions).map(option => `
                    <button 
                        class="bubble-option flex-1 py-2 px-3 border border-gray-300 rounded text-sm font-medium hover:bg-gray-100"
                        data-item="${i}" 
                        data-option="${option}"
                        data-action="select-bubble"
                    >
                        ${option}
                    </button>
                `).join('')}
            </div>
        `;
        grid.appendChild(itemDiv);
    }
    
    updateItemsCount();
}

// Select a bubble option
export function selectBubble(itemIndex, option) {
    console.log('selectBubble called:', itemIndex, option);
    
    // Toggle selection
    if (currentAnswers[itemIndex] === option) {
        currentAnswers[itemIndex] = null;
    } else {
        currentAnswers[itemIndex] = option;
    }
    
    console.log('Current answers after selection:', currentAnswers.filter(a => a !== null).length);
    
    // Update UI
    updateBubbleUI(itemIndex);
    updateItemsCount();
}

// Also make it available globally for event delegation
window.selectBubble = selectBubble;

function updateBubbleUI(itemIndex) {
    const buttons = document.querySelectorAll(`[data-item="${itemIndex}"]`);
    buttons.forEach(btn => {
        const option = btn.dataset.option;
        if (currentAnswers[itemIndex] === option) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

function updateItemsCount() {
    const count = currentAnswers.filter(a => a !== null).length;
    document.getElementById('items-count').textContent = count;
}

// Open modal for creating new answer key
export function openAnswerKeyModal() {
    currentEditingKey = null;
    currentAnswers = new Array(50).fill(null);
    document.getElementById('modal-title').textContent = 'Create Answer Key';
    document.getElementById('key-name').value = '';
    generateAnswerGrid();
    document.getElementById('answer-key-modal').classList.remove('hidden');
    document.getElementById('answer-key-modal').classList.add('flex');
}

window.openAnswerKeyModal = openAnswerKeyModal;

// Open modal for editing existing answer key
export function openEditAnswerKeyModal(id) {
    storage.getAnswerKey(id).then(key => {
        if (!key) return;
        
        currentEditingKey = key;
        currentAnswers = [...key.answers];
        // Ensure array is 50 items
        while (currentAnswers.length < 50) {
            currentAnswers.push(null);
        }
        
        document.getElementById('modal-title').textContent = 'Edit Answer Key';
        document.getElementById('key-name').value = key.subject;
        generateAnswerGrid();
        
        // Update UI to show current selections
        currentAnswers.forEach((answer, index) => {
            if (answer) {
                updateBubbleUI(index);
            }
        });
        
        updateItemsCount();
        document.getElementById('answer-key-modal').classList.remove('hidden');
        document.getElementById('answer-key-modal').classList.add('flex');
    });
}

window.openEditAnswerKeyModal = openEditAnswerKeyModal;

// Close modal
export function closeAnswerKeyModal() {
    document.getElementById('answer-key-modal').classList.add('hidden');
    document.getElementById('answer-key-modal').classList.remove('flex');
    currentEditingKey = null;
    currentAnswers = new Array(50).fill(null);
}

window.closeAnswerKeyModal = closeAnswerKeyModal;

// Save answer key
export function saveAnswerKey() {
    const name = document.getElementById('key-name').value.trim();
    
    if (!name) {
        alert('Please enter a subject/exam name');
        return;
    }
    
    // Trim trailing nulls
    const lastFilledIndex = currentAnswers.findLastIndex(a => a !== null);
    const trimmedAnswers = currentAnswers.slice(0, lastFilledIndex + 1);
    
    if (trimmedAnswers.length === 0) {
        alert('Please fill at least one answer');
        return;
    }
    
    const key = {
        id: currentEditingKey ? currentEditingKey.id : generateUUID(),
        subject: name,
        created: currentEditingKey ? currentEditingKey.created : new Date().toISOString(),
        updated: new Date().toISOString(),
        totalItems: trimmedAnswers.length,
        answers: trimmedAnswers
    };
    
    storage.saveAnswerKey(key).then(() => {
        closeAnswerKeyModal();
        loadAnswerKeys();
    });
}

window.saveAnswerKey = saveAnswerKey;

// Delete answer key
export function deleteAnswerKey(id) {
    if (!confirm('Are you sure you want to delete this answer key?')) return;
    
    storage.deleteAnswerKey(id).then(() => {
        loadAnswerKeys();
    });
}

window.deleteAnswerKey = deleteAnswerKey;

// Duplicate answer key
export function duplicateAnswerKey(id) {
    storage.getAnswerKey(id).then(key => {
        if (!key) return;
        
        const duplicated = {
            ...key,
            id: generateUUID(),
            subject: key.subject + ' (Copy)',
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };
        
        storage.saveAnswerKey(duplicated).then(() => {
            loadAnswerKeys();
        });
    });
}

window.duplicateAnswerKey = duplicateAnswerKey;

// Fill from CSV
export function fillFromCSV() {
    const input = prompt('Paste CSV answers (comma-separated, e.g., A,B,C,D,A):');
    if (!input) return;
    
    const answers = input.split(',').map(a => a.trim().toUpperCase());
    const validOptions = ['A', 'B', 'C', 'D', 'E'];
    
    currentAnswers = new Array(50).fill(null);
    
    answers.forEach((answer, index) => {
        if (index < 50 && validOptions.includes(answer)) {
            currentAnswers[index] = answer;
        }
    });
    
    // Update UI
    for (let i = 0; i < 50; i++) {
        updateBubbleUI(i);
    }
    updateItemsCount();
}

window.fillFromCSV = fillFromCSV;

// Load and display answer keys
export async function loadAnswerKeys() {
    const keys = await storage.getAnswerKeys();
    const listContainer = document.getElementById('answer-keys-list');
    const noKeysMessage = document.getElementById('no-keys-message');
    
    if (keys.length === 0) {
        listContainer.innerHTML = '';
        noKeysMessage.classList.remove('hidden');
        return;
    }
    
    noKeysMessage.classList.add('hidden');
    
    listContainer.innerHTML = keys.map(key => `
        <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-semibold text-gray-800">${escapeHtml(key.subject)}</h3>
                    <p class="text-sm text-gray-500">${key.totalItems} items • Created ${new Date(key.created).toLocaleDateString()}</p>
                </div>
                <div class="flex gap-2">
                    <button data-action="edit-answer-key" data-id="${key.id}" class="p-2 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                    </button>
                    <button data-action="duplicate-answer-key" data-id="${key.id}" class="p-2 text-green-600 hover:bg-green-50 rounded" title="Duplicate">
                        <i data-lucide="copy" class="w-4 h-4"></i>
                    </button>
                    <button data-action="delete-answer-key" data-id="${key.id}" class="p-2 text-red-600 hover:bg-red-50 rounded" title="Delete">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
            <div class="mt-3 flex flex-wrap gap-1">
                ${key.answers.slice(0, 10).map((a, i) => `
                    <span class="inline-flex items-center justify-center w-6 h-6 text-xs font-medium bg-gray-100 rounded">${i + 1}:${a}</span>
                `).join('')}
                ${key.answers.length > 10 ? `<span class="text-xs text-gray-500">+${key.answers.length - 10} more</span>` : ''}
            </div>
        </div>
    `).join('');
    
    // Re-initialize Lucide icons
    lucide.createIcons();
}

// Update answer key select dropdown
export async function updateAnswerKeySelect() {
    const keys = await storage.getAnswerKeys();
    const select = document.getElementById('grade-key-select');
    
    select.innerHTML = '<option value="">-- Select an answer key --</option>' +
        keys.map(key => `<option value="${key.id}">${escapeHtml(key.subject)} (${key.totalItems} items)</option>`).join('');
}

// Utility functions
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
