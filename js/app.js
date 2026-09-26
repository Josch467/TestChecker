// Main Application Entry Point

import { loadAnswerKeys, updateAnswerKeySelect, showTab } from './ui.js';
import { cleanupCamera } from './camera.js';
import { openAnswerKeyModal, closeAnswerKeyModal, saveAnswerKey, fillFromCSV } from './answer-key.js';
import { openCameraModal, closeCameraModal, capturePhoto, handleFileUpload, clearImage } from './camera.js';
import { gradeSheet } from './ui.js';
import { exportHistory, clearAllData, updateThreshold } from './ui.js';

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Bubble Sheet Grader initializing...');
    
    // Load initial data
    loadAnswerKeys();
    updateAnswerKeySelect();
    
    // Initialize Lucide icons
    lucide.createIcons();
    
    // Set up event delegation for all button clicks
    setupEventDelegation();
    
    // Set up event listeners for cleanup
    window.addEventListener('beforeunload', () => {
        cleanupCamera();
    });
    
    console.log('Bubble Sheet Grader initialized');
});

// Centralized event delegation system
function setupEventDelegation() {
    document.addEventListener('click', (event) => {
        const button = event.target.closest('button, [data-action]');
        if (!button) return;
        
        const action = button.dataset.action;
        if (!action) return;
        
        event.preventDefault();
        
        switch(action) {
            case 'open-answer-key-modal':
                openAnswerKeyModal();
                break;
            case 'close-answer-key-modal':
                closeAnswerKeyModal();
                break;
            case 'save-answer-key':
                saveAnswerKey();
                break;
            case 'fill-from-csv':
                fillFromCSV();
                break;
            case 'open-camera-modal':
                openCameraModal();
                break;
            case 'close-camera-modal':
                closeCameraModal();
                break;
            case 'capture-photo':
                capturePhoto();
                break;
            case 'trigger-file-upload':
                document.getElementById('file-input').click();
                break;
            case 'clear-image':
                clearImage();
                break;
            case 'grade-sheet':
                gradeSheet();
                break;
            case 'export-history':
                exportHistory();
                break;
            case 'clear-all-data':
                clearAllData();
                break;
            case 'edit-answer-key':
                const editId = button.dataset.id;
                import('./answer-key.js').then(({ openEditAnswerKeyModal }) => {
                    openEditAnswerKeyModal(editId);
                });
                break;
            case 'duplicate-answer-key':
                const dupId = button.dataset.id;
                import('./answer-key.js').then(({ duplicateAnswerKey }) => {
                    duplicateAnswerKey(dupId);
                });
                break;
            case 'delete-answer-key':
                const deleteId = button.dataset.id;
                import('./answer-key.js').then(({ deleteAnswerKey }) => {
                    deleteAnswerKey(deleteId);
                });
                break;
            case 'view-result-detail':
                const viewId = button.dataset.id;
                import('./ui.js').then(({ viewResultDetail }) => {
                    viewResultDetail(viewId);
                });
                break;
            case 'delete-result':
                const resultDeleteId = button.dataset.id;
                import('./ui.js').then(({ deleteResult }) => {
                    deleteResult(resultDeleteId);
                });
                break;
        }
    });
    
    // Handle tab navigation
    document.querySelectorAll('[data-tab]').forEach(tabButton => {
        tabButton.addEventListener('click', () => {
            const tabName = tabButton.dataset.tab;
            showTab(tabName);
        });
    });
    
    // Handle file input change
    document.getElementById('file-input').addEventListener('change', handleFileUpload);
    
    // Handle answer key select change
    document.getElementById('grade-key-select').addEventListener('change', function() {
        const gradeButton = document.getElementById('grade-button');
        const hasImage = document.getElementById('image-preview-container').classList.contains('hidden') === false;
        
        gradeButton.disabled = !this.value || !hasImage;
    });
    
    // Handle settings changes
    document.getElementById('threshold-slider').addEventListener('input', updateThreshold);
    
    document.getElementById('max-options').addEventListener('change', function() {
        import('./storage.js').then(({ settings }) => {
            settings.update('maxOptions', parseInt(this.value));
        });
    });
    
    // Handle bubble selection in answer key modal
    document.addEventListener('click', (event) => {
        const bubbleOption = event.target.closest('.bubble-option');
        if (bubbleOption && bubbleOption.dataset.item !== undefined) {
            const itemIndex = parseInt(bubbleOption.dataset.item);
            const option = bubbleOption.dataset.option;
            
            // Call the globally available selectBubble function
            if (window.selectBubble) {
                window.selectBubble(itemIndex, option);
            }
        }
    });
    
}
