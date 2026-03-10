# Class Health Analyzer

A full-stack web platform built to calculate student health scores based on attendance time and speaking time extracted from .vtt transcripts.

## Technology Stack
- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Vanilla CSS (Modern Light Component-based UI)
- **Backend**: Node.js, Express (acts as static server for production & API ready)
- **Storage**: LocalStorage (client-side data persistence for simplicity and speed)

## Features Included
1. **Dashboard**: 5 renameable default classes with quick navigation.
2. **Transcript Upload (.vtt)**: Auto-parses timestamps and extracts speaker engagement times automatically. Option to exclude the Teacher's speaking time from max calculations.
3. **Attendance Input**: Supports `Name - minutes` copy-paste form.
4. **Calculations Engine**: Applies 60% Attendance and 40% Engagement formula dynamically grading with tags (Excellent, Good, Needs Attention).
5. **Rich Export**: Download historical or new reports as `JSON`, `CSV`, or `Excel (.xlsx)`.

## Setup Instructions

**Prerequisite**: You must install [Node.js](https://nodejs.org/) on your machine.
If you have an Apple Silicon Mac, you can install Node via Homebrew `brew install node` or download it from the Node website.

1. **Open Terminal** and cd into the `class-health-analyzer` root folder.
2. **Install all dependencies** by running:
   ```sh
   npm run install:all
   ```
3. **Run the Development Server** (Frontend Hot Reloading):
   ```sh
   npm run dev
   ```
4. **Build and Serve for Production** (Fullstack):
   ```sh
   npm run prod
   ```
   *The platform relies completely on LocalStorage for persistence, keeping it extremely portable and functional without complex DB setup required.*
# Dashboard-skillcase
