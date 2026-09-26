# Bubble Sheet Grader

A browser-based bubble sheet answer grader that automatically detects and grades multiple-choice answer sheets (up to 50 items, A-E). All data is stored locally in the browser - no server required.

## Features

- **Answer Key Management**: Create, edit, duplicate, and delete answer keys for any subject
- **Variable-Length Support**: Support for answer keys of any length from 1-50 items
- **Image Capture**: Upload images or capture photos directly from your device camera
- **Automatic Grading**: Uses OpenCV.js for bubble detection and automatic scoring
- **Results History**: View and filter past grading results
- **Export Functionality**: Export results as CSV for further analysis
- **Offline Support**: Works without internet connection using Service Worker
- **Privacy First**: All data stored locally in your browser

## Technology Stack

- **Frontend**: HTML5, Vanilla JavaScript (ES6 modules)
- **Styling**: Tailwind CSS (CDN)
- **Computer Vision**: OpenCV.js for bubble detection
- **Storage**: localStorage (answer keys) + IndexedDB (grading history)
- **Icons**: Lucide Icons
- **Offline**: Service Worker with Cache API

## How to Use

### 1. Create an Answer Key

1. Click on the "Answer Keys" tab
2. Click "Add Answer Key"
3. Enter a subject/exam name (e.g., "Mathematics Quiz")
4. Fill in the correct answers for each question (A-E options)
5. Click "Save Answer Key"

### 2. Grade an Answer Sheet

1. Click on the "Grade Sheet" tab
2. Select the answer key you want to use
3. Upload an image of the filled bubble sheet or use your camera to capture it
4. Click "Grade Sheet"
5. View the results including score, percentage, and item-by-item breakdown

### 3. View History

1. Click on the "History" tab
2. View all past grading results
3. Filter by subject
4. Export results as CSV

### 4. Settings

1. Click on the "Settings" tab
2. Adjust detection threshold for bubble recognition
3. Change maximum options (A-D or A-E)
4. Clear all data if needed

## Project Structure

```
bubble-sheet-grader/
├── index.html          # Main HTML file
├── css/
│   └── styles.css      # Custom styles (if needed)
├── js/
│   ├── app.js          # Main application entry point
│   ├── storage.js      # localStorage and IndexedDB operations
│   ├── answer-key.js   # Answer key management
│   ├── camera.js       # Camera capture and file upload
│   ├── omr.js          # OpenCV.js bubble detection
│   ├── grading.js      # Grading logic and score calculation
│   └── ui.js           # UI interactions and navigation
├── sw.js               # Service Worker for offline support
└── README.md           # This file
```

## Deployment

### Local Development

Simply open `index.html` in a modern web browser. No build process or server required.

### Production Deployment

#### GitHub Pages

1. Push the code to a GitHub repository
2. Enable GitHub Pages in repository settings
3. Select the main branch as source
4. Access at `https://username.github.io/repository-name`

#### Netlify

1. Drag and drop the project folder to Netlify
2. Or connect to GitHub repository
3. Deploy automatically

#### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project directory
3. Follow the prompts

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Any modern browser with ES6 module support

## Privacy & Data

- All data is stored locally in your browser
- No data is sent to any server
- Answer keys stored in localStorage
- Grading history stored in IndexedDB
- Clear data anytime from Settings

## Limitations

- Maximum 50 questions per answer key
- Maximum 5 options per question (A-E)
- Best results with clear, well-lit images
- Works best with standard bubble sheet layouts

## Troubleshooting

### Camera not working
- Check browser permissions
- Try using file upload instead
- Ensure using HTTPS or localhost

### Poor bubble detection
- Ensure good lighting when capturing images
- Place paper on flat surface
- Adjust detection threshold in Settings
- Use high-resolution images

### OpenCV.js loading slowly
- OpenCV.js is ~8MB and loads from CDN
- First load may take time
- Subsequent loads use Service Worker cache

## Future Enhancements

- [ ] Support for PDF uploads
- [ ] Custom bubble sheet templates
- [ ] Batch grading multiple sheets
- [ ] Statistics and analytics
- [ ] Dark mode
- [ ] Mobile app (PWA improvements)

## License

MIT License - feel free to use and modify as needed.

## Credits

Built with OpenCV.js, Tailwind CSS, and modern web technologies.
