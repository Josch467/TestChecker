// Camera Module - Handles camera capture and file upload

let cameraStream = null;
let currentImageFile = null;
let torchOn = false;

// Open camera modal
export function openCameraModal() {
    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-preview');
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
    }).then(stream => {
        cameraStream = stream;
        video.srcObject = cameraStream;
        setupFlashButton();
    }).catch(error => {
        console.error('Camera error:', error);
        alert('Could not access camera. Please check permissions or use file upload instead.');
        closeCameraModal();
    });
}

window.openCameraModal = openCameraModal;

// Show flash button only if the camera supports torch
function setupFlashButton() {
    const btn = document.getElementById('flash-button');
    const video = document.getElementById('camera-preview');
    const track = video.srcObject ? video.srcObject.getVideoTracks()[0] : null;
    torchOn = false;
    updateFlashButton();

    const caps = track && track.getCapabilities ? track.getCapabilities() : {};
    if (caps.torch) {
        btn.classList.remove('hidden');
        // Direct handler, so it works even if app.js is outdated
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation(); // prevents a double toggle if app.js also handles it
            toggleFlash();
        };
    } else {
        btn.classList.add('hidden');
    }
}

//toggle flash
export async function toggleFlash() {
    alert('Flash button pressed'); // temporary test, remove later

    const video = document.getElementById('camera-preview');
    const track = video.srcObject ? video.srcObject.getVideoTracks()[0] : null;
    if (!track) {
        alert('No camera track found');
        return;
    }

    const next = !torchOn;
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Phone did not respond')), 3000));

    try {
        try {
            await Promise.race([track.applyConstraints({ advanced: [{ torch: next }] }), timeout]);
        } catch (e1) {
            await Promise.race([track.applyConstraints({ torch: next }), timeout]);
        }
        torchOn = next;
        updateFlashButton();
    } catch (e) {
        alert('Flash error: ' + e.message);
    }
}

window.toggleFlash = toggleFlash;

// Close camera modal
export function closeCameraModal() {
    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-preview');
    
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop()); // also turns flash off
        cameraStream = null;
    }
    
    torchOn = false;
    document.getElementById('flash-button').classList.add('hidden');
    
    video.srcObject = null;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

window.closeCameraModal = closeCameraModal;

// Capture photo from camera
export function capturePhoto() {
    const video = document.getElementById('camera-preview');
    const canvas = document.getElementById('camera-canvas');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob(blob => {
        currentImageFile = new File([blob], 'captured-photo.jpg', { type: 'image/jpeg' });
        displayImagePreview(canvas.toDataURL('image/jpeg'));
        closeCameraModal();
    }, 'image/jpeg', 0.9);
}

window.capturePhoto = capturePhoto;

// Handle file upload
export function handleFileUpload(event) {
    console.log('File upload triggered');
    const file = event.target.files[0];
    console.log('File selected:', file);
    
    if (!file) return;
    
    if (file.type === 'application/pdf') {
        alert('PDF files are not yet supported. Please use an image file (JPG/PNG).');
        return;
    }
    
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file (JPG/PNG).');
        return;
    }
    
    currentImageFile = file;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        console.log('File reader loaded');
        displayImagePreview(e.target.result);
    };
    reader.onerror = function(error) {
        console.error('File reader error:', error);
        alert('Error reading file');
    };
    reader.readAsDataURL(file);
}

window.handleFileUpload = handleFileUpload;

// Display image preview
function displayImagePreview(dataUrl) {
    const previewContainer = document.getElementById('image-preview-container');
    const preview = document.getElementById('image-preview');
    const gradeButton = document.getElementById('grade-button');
    
    preview.src = dataUrl;
    previewContainer.classList.remove('hidden');
    gradeButton.disabled = false;
}

// Clear uploaded image
export function clearImage() {
    currentImageFile = null;
    document.getElementById('image-preview-container').classList.add('hidden');
    document.getElementById('image-preview').src = '';
    document.getElementById('file-input').value = '';
    document.getElementById('grade-button').disabled = true;
}

window.clearImage = clearImage;

// Get current image for processing
export function getCurrentImage() {
    return currentImageFile;
}

// Clean up camera resources
export function cleanupCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}
