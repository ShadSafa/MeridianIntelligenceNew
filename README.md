# Meridian Intelligence - Scrolling Website

## Setup Guide

### 1. Robot Images ✓
All robot images are in place:
- robot-blue.png (Logic - Hero)
- robot-green.png (Jade - Strategy)
- robot-red.png (Ruby - Research)
- robot-orange.png (Nova - Analytics)
- robot-pink.png (Aria - Communication)

### 2. Generate Video Backgrounds with Higgsfield MCP

The website references 3 background videos:
- videos/hero-bg.mp4
- videos/capabilities-bg.mp4
- videos/cta-bg.mp4

#### Generate using Higgsfield MCP:

**Hero Background** (Tech/Innovation theme):
\\\
generate_video:
  prompt: "Futuristic AI technology abstract background with cyan glowing particles, digital networks, flowing data streams. Navy and cyan color scheme. 1920x1080, 10 seconds, smooth cinematic motion"
  output: "videos/hero-bg.mp4"
\\\

**Capabilities Background** (Dynamic data/analytics):
\\\
generate_video:
  prompt: "Animated data visualization background with flowing charts, analytics dashboards, hexagonal patterns. Cyan accents on dark navy. 1920x1080, 10 seconds, steady paced"
  output: "videos/capabilities-bg.mp4"
\\\

**CTA Background** (Corporate/professional):
\\\
generate_video:
  prompt: "Corporate technology background with subtle geometric patterns, glowing accent lines, professional ambiance. Navy, cyan, and pink accents. 1920x1080, 10 seconds, elegant motion"
  output: "videos/cta-bg.mp4"
\\\

### 3. Running the Website

\\\ash
cd C:\Users\shadi\Documents\Development\Higgsfield\meridian-scrolling-site

# Simple HTTP server
python -m http.server 8000

# Or use npx
npx http-server
\\\

Then visit: http://localhost:8000

## Features

✓ Smooth scroll animations
✓ Scroll-triggered fade-in effects
✓ Parallax background effects
✓ Interactive agent cards
✓ Video backgrounds (to be generated)
✓ Responsive design (mobile-friendly)
✓ Accessibility features
✓ Performance optimized

## File Structure

\\\
meridian-scrolling-site/
├── index.html (Main website)
├── styles.css (Styling & animations)
├── script.js (Scroll interactions)
├── robot-*.png (5 AI agent images)
├── videos/ (Generated backgrounds)
│   ├── hero-bg.mp4
│   ├── capabilities-bg.mp4
│   └── cta-bg.mp4
└── README.md (This file)
\\\

## Next Steps

1. Generate the 3 video backgrounds using Higgsfield MCP
2. Place videos in the \ideos/\ folder
3. Start the local server
4. Test scrolling experience
5. Customize colors/content as needed
