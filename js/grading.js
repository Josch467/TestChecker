// Grading Module - Handles score calculation and comparison

import { storage } from './storage.js';

// Grade detected answers against answer key
export function gradeAnswers(detectedAnswers, answerKey) {
    const keyAnswers = answerKey.answers;
    const totalItems = answerKey.totalItems;
    
    // Only compare the first N items where N = key length
    const relevantDetected = detectedAnswers.slice(0, totalItems);
    
    let correct = 0;
    const wrongItems = [];
    const blankItems = [];
    
    for (let i = 0; i < totalItems; i++) {
        const keyAnswer = keyAnswers[i];
        const detectedAnswer = relevantDetected[i];
        
        if (detectedAnswer === keyAnswer) {
            correct++;
        } else if (detectedAnswer === null || detectedAnswer === undefined) {
            blankItems.push(i + 1); // 1-indexed for display
        } else {
            wrongItems.push(i + 1); // 1-indexed for display
        }
    }
    
    const percentage = totalItems > 0 ? (correct / totalItems) * 100 : 0;
    
    return {
        score: correct,
        total: totalItems,
        percentage: percentage.toFixed(2),
        wrongItems: wrongItems,
        blankItems: blankItems,
        answersDetected: relevantDetected,
        keyAnswers: keyAnswers
    };
}

// Save grading result to IndexedDB
export async function saveGradingResult(answerKeyId, result, imageThumbnail) {
    const answerKey = await storage.getAnswerKey(answerKeyId);
    
    const resultRecord = {
        id: generateUUID(),
        keyId: answerKeyId,
        subject: answerKey.subject,
        timestamp: new Date().toISOString(),
        score: result.score,
        total: result.total,
        percentage: parseFloat(result.percentage),
        answersDetected: result.answersDetected,
        wrongItems: result.wrongItems,
        blankItems: result.blankItems,
        imageThumbnail: imageThumbnail
    };
    
    await storage.saveResult(resultRecord);
    return resultRecord;
}

// Get grade letter based on percentage
export function getGradeLetter(percentage) {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
}

// Get color class based on percentage
export function getPercentageColor(percentage) {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 80) return 'text-blue-600';
    if (percentage >= 70) return 'text-yellow-600';
    if (percentage >= 60) return 'text-orange-600';
    return 'text-red-600';
}

// Get background color class based on percentage
export function getPercentageBgColor(percentage) {
    if (percentage >= 90) return 'bg-green-100';
    if (percentage >= 80) return 'bg-blue-100';
    if (percentage >= 70) return 'bg-yellow-100';
    if (percentage >= 60) return 'bg-orange-100';
    return 'bg-red-100';
}

// Utility function to generate UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
