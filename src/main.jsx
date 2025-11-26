import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Outlet } from 'react-router-dom'
import App from './App.jsx'
import PrintView from './print/PrintView.jsx'
import PrintPrescription from './print/PrintPrescription.jsx'
import PatientPage from './pages/PatientPage.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import Protected from './auth/Protected.jsx'
import DbDiscovery from './components/Startup/DbDiscovery.jsx'
import TopBar from './components/Layout/TopBar.jsx'
import ConfigPanel from './components/Config/ConfigPanel.jsx'
import './styles.css'

function MainLayout() {
  return (
    <>
      <TopBar />
      <div className="main-content">
        <Outlet />
      </div>
    </>
  );
}

function Root() {
  const [configured, setConfigured] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        if (window.configApi) {
          const { dbPath } = await window.configApi.getDbPath();
          if (dbPath) setConfigured(true);
        }
      } catch (e) {
        console.error("Config check failed:", e);
      } finally {
        setChecking(false);
      }
    }
    check();
  }, []);

  if (checking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'system-ui' }}>
        Cargando configuración...
      </div>
    );
  }

  if (!configured) {
    return <DbDiscovery onConfigured={() => setConfigured(true)} />;
  }

  return (
    <AuthProvider>
      <HashRouter>
        <Protected>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<App />} />
              <Route path="/config" element={<ConfigPanel />} />
              <Route path="/patient/:patientId" element={<PatientPage />} />
            </Route>
            <Route path="/print/:patientId" element={<PrintView />} />
            <Route path="/rx/:encounterId" element={<PrintPrescription />} />
          </Routes>
        </Protected>
      </HashRouter>
    </AuthProvider>
  );
}

createRoot(document.getElementById('root')).render(<Root />)
