// OMR Module - Handles bubble detection using OpenCV.js

let cv = null;
let cvReady = false;

// Load OpenCV.js
export async function loadOpenCV() {
    if (cvReady) return true;
    
    return new Promise((resolve, reject) => {
        if (window.cv && window.cv.Mat) {
            cv = window.cv;
            cvReady = true;
            resolve(true);
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
        script.async = true;
        script.onload = () => {
            // Wait for OpenCV to be fully initialized
            const checkInterval = setInterval(() => {
                if (window.cv && window.cv.Mat) {
                    clearInterval(checkInterval);
                    cv = window.cv;
                    cvReady = true;
                    console.log('OpenCV.js loaded successfully');
                    resolve(true);
                }
            }, 100);
            
            // Timeout after 30 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('OpenCV.js loading timeout'));
            }, 30000);
        };
        script.onerror = () => reject(new Error('Failed to load OpenCV.js'));
        document.head.appendChild(script);
    });
}

// Preprocess image for bubble detection
export function preprocessImage(imageElement) {
    if (!cvReady) {
        throw new Error('OpenCV.js not loaded');
    }
    
    // Read image
    const src = cv.imread(imageElement);
    const dst = new cv.Mat();
    const gray = new cv.Mat();
    const thresh = new cv.Mat();
    
    try {
        // Convert to grayscale
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        
        // Apply Gaussian blur to reduce noise
        cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
        
        // Apply adaptive thresholding
        cv.adaptiveThreshold(gray, thresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
        
        // Store the processed image
        dst = thresh.clone();
        
        return {
            processed: dst,
            original: src,
            gray: gray
        };
    } catch (error) {
        // Cleanup on error
        src.delete();
        dst.delete();
        gray.delete();
        thresh.delete();
        throw error;
    }
}

// Detect bubbles in the image
export function detectBubbles(processedImage, threshold = 128) {
    if (!cvReady) {
        throw new Error('OpenCV.js not loaded');
    }
    
    const answers = new Array(50).fill(null);
    
    try {
        // This is a simplified implementation
        // In a real implementation, you would:
        // 1. Detect the grid structure
        // 2. Locate each question row
        // 3. For each question, measure the darkness of each bubble (A-E)
        // 4. Determine which bubble is filled based on threshold
        
        // For now, return a placeholder implementation
        // This would be replaced with actual OpenCV-based detection
        
        // Simulated detection - replace with actual implementation
        // The real implementation would use cv.countNonZero() on circular regions
        // to determine which bubble is filled
        
        return answers;
    } catch (error) {
        throw error;
    }
}

// Advanced bubble detection with grid detection
export function detectBubblesAdvanced(imageElement, threshold = 128) {
    if (!cvReady || !cv || !cv.Mat) {
        console.error('OpenCV.js not properly loaded');
        console.log('cvReady:', cvReady, 'cv:', cv, 'cv.Mat:', cv ? cv.Mat : 'N/A');
        throw new Error('OpenCV.js not loaded. Please wait for it to finish loading or refresh the page.');
    }
    
    try {
        const src = cv.imread(imageElement);
        const gray = new cv.Mat();
        const thresh = new cv.Mat();
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        
        try {
            // Convert to grayscale
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
            
            // Apply threshold
            cv.threshold(gray, thresh, threshold, 255, cv.THRESH_BINARY_INV);
            
            // Find contours
            cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
            
            console.log('Found', contours.size(), 'contours');
            
            // Filter contours to find bubbles
            const bubbles = [];
            for (let i = 0; i < contours.size(); i++) {
                const contour = contours.get(i);
                const area = cv.contourArea(contour);
                
                // Filter by area (adjust these values based on your bubble sheet)
                if (area > 100 && area < 5000) {
                    const perimeter = cv.arcLength(contour, true);
                    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
                    
                    // Check if circular
                    if (circularity > 0.7) {
                        const moment = cv.moments(contour);
                        const cx = moment.m10 / moment.m00;
                        const cy = moment.m01 / moment.m00;
                        
                        bubbles.push({
                            x: cx,
                            y: cy,
                            area: area,
                            circularity: circularity
                        });
                    }
                }
            }
            
            console.log('Found', bubbles.length, 'potential bubbles');
            
            // Sort bubbles by position (top to bottom, left to right)
            bubbles.sort((a, b) => {
                if (Math.abs(a.y - b.y) < 20) {
                    return a.x - b.x;
                }
                return a.y - b.y;
            });
            
            // Group bubbles by question (5 bubbles per question)
            const answers = new Array(50).fill(null);
            const options = ['A', 'B', 'C', 'D', 'E'];
            
            for (let i = 0; i < Math.min(bubbles.length / 5, 50); i++) {
                const questionBubbles = bubbles.slice(i * 5, (i + 1) * 5);
                
                // Find the darkest bubble (most filled)
                let maxArea = 0;
                let selectedOption = null;
                
                questionBubbles.forEach((bubble, optIndex) => {
                    if (bubble.area > maxArea) {
                        maxArea = bubble.area;
                        selectedOption = options[optIndex];
                    }
                });
                
                // Only mark as selected if it's significantly darker than others
                if (maxArea > 200) { // Adjust threshold based on testing
                    answers[i] = selectedOption;
                }
            }
            
            console.log('Detected answers:', answers.filter(a => a !== null).length, 'out of 50');
            
            return answers;
        } finally {
            src.delete();
            gray.delete();
            thresh.delete();
            contours.delete();
            hierarchy.delete();
        }
    } catch (error) {
        console.error('Error in detectBubblesAdvanced:', error);
        throw new Error('Bubble detection failed: ' + error.message);
    }
}

// Clean up OpenCV resources
export function cleanupOpenCV(...mats) {
    mats.forEach(mat => {
        if (mat && mat.delete) {
            mat.delete();
        }
    });
}

// Check if OpenCV is ready
export function isOpenCVReady() {
    return cvReady;
}
