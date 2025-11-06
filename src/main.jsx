// src/main.jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import PrintView from './print/PrintView.jsx'
import PrintPrescription from './print/PrintPrescription.jsx'
import PatientPage from './pages/PatientPage.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <HashRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/patient/:patientId" element={<PatientPage />} />
      <Route path="/print/:patientId" element={<PrintView />} />
      <Route path="/rx/:encounterId" element={<PrintPrescription />} />
    </Routes>
  </HashRouter>
)
