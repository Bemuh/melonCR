import React, { useState, useEffect } from 'react'
import Intake from './intake/Intake.jsx'
import DoctorProfileForm from './components/Auth/DoctorProfileForm.jsx'
import db from './db/index.js'

import { useAuth } from './auth/AuthContext.jsx';

export default function App() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkProfile = async () => {
    try {
      // Ensure DB is ready (it should be if we are here)
      const rows = db.exec('SELECT * FROM doctor_profile LIMIT 1');
      if (rows && rows.length > 0) {
        setProfile(rows[0]);
      } else {
        setProfile(null);
      }
    } catch (e) {
      console.error("Error checking profile:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkProfile();
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) return <div className="container" style={{ padding: '20px' }}>Cargando...</div>;

  if (!profile) {
    return (
      <div className="container" style={{ padding: '20px' }}>
        <DoctorProfileForm onSaved={checkProfile} />
      </div>
    );
  }

  return (
    <div className='container'>
      <Intake />
    </div>
  )
}