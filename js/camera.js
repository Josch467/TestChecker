// Camera Module - Handles camera capture and file upload

let cameraStream = null;
let currentImageFile = null;

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
    }).catch(error => {
        console.error('Camera error:', error);
        alert('Could not access camera. Please check permissions or use file upload instead.');
        closeCameraModal();
    });
}

window.openCameraModal = openCameraModal;

// Close camera modal
export function closeCameraModal() {
    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-preview');
    
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    
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
    const file = event.target.files[0];
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
        displayImagePreview(e.target.result);
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
