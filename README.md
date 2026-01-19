# 📚 AlbumSnap

> Capture Facebook album images in theater mode and save them as a beautiful PDF.

## ✨ Features

- 🖼️ Captures all images from Facebook posts/albums in theater mode
- 📄 Generates high-quality PDF documents
- 🔄 Supports drag-and-drop reordering
- ✅ Select/deselect individual images
- 📏 Preserves original image quality and aspect ratios
- 🎨 Beautiful, modern UI with glassmorphism design

## 🚀 Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked** and select this folder
5. The 📚 AlbumSnap icon will appear in your extensions bar

## 📖 How to Use

1. **Open Facebook** and navigate to a post or album with images
2. **Click on any image** to open it in Theater Mode (black background)
3. **Click the AlbumSnap extension** icon in your browser
4. **Click "Initialize Scanner"** to start capturing images
5. **Navigate through images** using arrow keys or clicking
6. When done, the dashboard will open showing all captured images
7. **Reorder, select/deselect** images as needed
8. **Click "Generate PDF"** to save your album!

## 🛠️ Tech Stack

- Vanilla JavaScript
- Chrome Extension Manifest V3
- jsPDF for PDF generation
- Modern CSS with glassmorphism effects

## 📁 Project Structure

```
📚 AlbumSnap/
├── manifest.json      # Extension configuration
├── popup.html         # Extension popup UI
├── popup.js           # Popup logic
├── generate.html      # Dashboard for image management
├── generate.js        # PDF generation logic
├── content.js         # Page content script
├── background.js      # Service worker
├── jspdf.js           # PDF library
├── icon.png           # Extension icon
└── README.md          # This file
```

## 📝 License

MIT License - Feel free to use and modify!

---

Made with ❤️ for preserving your Facebook memories