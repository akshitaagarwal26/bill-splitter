# 🧾 SplitMyBill

> Split a restaurant bill from a photograph — quickly, accurately, and fairly.

SplitMyBill is a full-stack web application that uses **OCR (Optical Character Recognition)** to extract items and prices from a photographed restaurant bill. Users can review and edit the extracted items, assign items to people, and instantly calculate how much each person should pay.

---

## 🚀 Features

- 📸 **Upload a bill photograph**
- 🔍 **OCR-based bill processing**
- 🧾 Automatically extracts:
  - Item names
  - Prices
  - Quantities
  - Subtotal
  - Service charges
  - GST/taxes
  - Grand total
- ✏️ **Edit extracted items** if OCR makes a mistake
- 👥 **Assign items to multiple people**
- ➗ **Automatically split shared items**
- 💰 Calculates each person's share
- 📊 Displays a detailed split breakdown
- 🖼️ Shows a preview of the uploaded receipt
- ⚡ FastAPI backend with React frontend
- 📱 Responsive interface

---

## 🛠️ Tech Stack

### Frontend

- React
- Vite
- JavaScript
- CSS

### Backend

- Python
- FastAPI
- Uvicorn
- OpenCV
- Pillow
- Tesseract OCR
- pytesseract

### Deployment

- Frontend: Vercel
- Backend: Render
- Source Control: GitHub

---
 

## 🏗️ Project Structure

```text
bill-splitter/
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── venv/                 # Local virtual environment (not committed)
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── ...
│   ├── package.json
│   └── ...
│
├── .gitignore
└── README.md

