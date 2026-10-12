// Camera Module - Handles camera capture and file upload

let cameraStream = null;
let currentImageFile = null;
let torchOn = false;

// Open camera modal
export async function openCameraModal() {
    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-preview');

    // release any old stream first
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } }
        });
    } catch (error) {
        console.error('Camera error:', error);
        alert('Camera error: ' + error.name + ' - ' + error.message);
        closeCameraModal();
        return;
    }

    video.srcObject = cameraStream;
    try {
        await video.play();
    } catch (e) {
        console.warn('Video play issue:', e);
    }

    // flash setup must never break the camera
    try {
        setupFlashButton();
    } catch (e) {
        console.warn('Flash setup failed:', e);
    }
}

window.openCameraModal = openCameraModal;

// Reset flash button state
function setupFlashButton() {
    torchOn = false;
    updateFlashButton();
}

function updateFlashButton() {
    const btn = document.getElementById('flash-button');
    const label = document.getElementById('flash-label');
    if (!btn || !label) return;
    label.textContent = torchOn ? 'Flash On' : 'Flash Off';
    btn.classList.toggle('bg-yellow-300', torchOn);
    btn.classList.toggle('text-yellow-900', torchOn);
}

// Toggle flash (torch)
export async function toggleFlash() {
    const track = cameraStream ? cameraStream.getVideoTracks()[0] : null;
    if (!track) {
        alert('Camera is not ready yet.');
        return;
    }

    const next = !torchOn;
    try {
        await track.applyConstraints({ advanced: [{ torch: next }] });
        torchOn = next;
        updateFlashButton();
    } catch (e) {
        alert('Flash is not supported on this device or browser.\n(' + e.name + ': ' + e.message + ')');
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
    updateFlashButton();

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
