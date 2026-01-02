# Healthcare Invoice Management System - Frontend

Modern React-based frontend for managing healthcare invoices, patient outreach, and payment tracking.

## Overview

A responsive, user-friendly interface for healthcare providers to manage accounts receivable. Features include dashboard analytics, calendar view for payment tracking, invoice lists organized by file upload, and integrated calling functionality.

## Key Features

### 📊 Dashboard
- **Total Statistics**: View total invoices, unique patients, and payment summaries
- **Aging Bucket Distribution**: Visual breakdown of invoices by age (0-30, 31-60, 61-90, 90+ days)
- **Calendar View**: Interactive calendar displaying:
  - Payment dates
  - Estimated payment dates from patient commitments
  - Color-coded events for easy identification
- **Quick Filters**: Filter by date ranges and payment status

### 📋 Invoice List Section
- **File-Based Organization**: View invoices grouped by uploaded file
- **Upload History**: See all uploaded files with statistics:
  - Patient count per file
  - New vs. updated records
  - Upload timestamps
- **Patient Table**: Detailed patient information including:
  - Invoice number and patient name
  - Outstanding balances
  - Payment status
  - Call count and history
  - Link sent/requested status
  - Estimated payment dates

### 💬 Patient Interaction
- **Call Management**:
  - Initiate calls with confirmation modal
  - View call history for each patient/invoice
  - Track call count and last called timestamp
- **Notes Management**:
  - View detailed notes in modal
  - See AI-extracted information (link requested, link sent, estimated date)
- **Payment Links**: Send Stripe payment links directly to patients

### 🔄 Real-Time Updates
- **Auto-refresh**: Patient table refreshes automatically (3-second interval)
- **Toast Notifications**: Success/error messages for all actions
- **Live Status Updates**: Call status and payment information update in real-time

### 🎨 User Experience
- **Clean Interface**: Modern design with Tailwind CSS
- **Responsive Layout**: Works on desktop and tablet devices
- **Modal System**: 
  - Call History Modal
  - Notes Modal
  - Call Confirmation Modal
  - Message Alerts
- **Intuitive Navigation**: Easy switching between Dashboard, Invoice List, and Upload sections

## Project Structure

```
src/
├── components/
│   ├── Dashboard.tsx          # Main dashboard with statistics and calendar
│   ├── InvoiceList.tsx        # File upload list and invoice display
│   ├── PatientTable.tsx       # Patient data table with actions
│   ├── CallHistoryModal.tsx   # Call history viewer
│   ├── NotesModal.tsx         # Notes viewer
│   ├── ConfirmModal.tsx       # Confirmation dialogs
│   └── FileUpload.tsx         # CSV upload component
├── services/
│   └── api.ts                 # API client with all endpoints
├── utils/
│   └── timezone.ts            # Date/time formatting utilities
└── App.tsx                    # Main application component
```

## Quick Start

```bash
# Install dependencies
npm install

# Create environment file
echo "VITE_API_URL=http://localhost:8000" > .env

# Run development server
npm run dev
```

Application runs at: `http://localhost:5173`

## Environment Variables

- `VITE_API_URL`: Backend API URL (default: `http://localhost:8000`)

## Key Components

### Dashboard
- Displays analytics from `/analytics/dashboard`
- Calendar view showing payment dates and commitments
- Real-time statistics updates

### Invoice List
- Lists all uploaded files
- Shows patients for each file upload
- Supports filtering and searching
- View/action buttons for each patient record

### Patient Table
- Comprehensive patient information display
- Action buttons:
  - **View Notes**: Opens notes modal
  - **View Call History**: Opens call history modal (clickable on call count)
  - **Call**: Initiates call with confirmation
- Real-time status indicators

## Features by Section

### Upload CSV Section
- Drag-and-drop file upload
- File selector dropdown
- Patient table with filtering options
- View notes and call history directly from table

### Invoice List Section
- File upload history
- Click any file to view its patients
- Full patient management capabilities
- Back navigation to file list

### Dashboard Section
- Overall statistics
- Calendar visualization
- Aging bucket charts
- Payment status overview

## Technology Stack

- **React 19** with TypeScript
- **Tailwind CSS** for styling
- **Axios** for API calls
- **React Icons** for iconography
- **Vite** as build tool

## API Integration

All API calls are centralized in `src/services/api.ts`:
- Patient data fetching
- File upload and management
- Call operations
- Payment link sending
- Analytics data

## State Management

- React hooks (`useState`, `useEffect`, `useCallback`)
- Local state for UI components
- Auto-refresh for patient data
- Active call tracking to prevent duplicate calls

## Notes

- Responsive design for modern browsers
- Optimized for healthcare workflow efficiency
- Real-time updates for accurate data display
- Clean, professional UI suitable for medical office use
