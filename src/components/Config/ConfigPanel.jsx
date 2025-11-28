import React, { useState, useEffect } from 'react';
import DoctorProfileForm from '../Auth/DoctorProfileForm.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import db from '../../db/index.js';

export default function ConfigPanel() {
    const { changePassword, inactivityTimeout, updateInactivityTimeout } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [profileData, setProfileData] = useState(null);

    // Password state
    const [pwdData, setPwdData] = useState({ current: '', new: '', confirm: '' });
    const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });

    // Timer state
    const [timerVal, setTimerVal] = useState(10);

    useEffect(() => {
        loadProfile();
    }, []);

    useEffect(() => {
        if (inactivityTimeout) setTimerVal(inactivityTimeout);
    }, [inactivityTimeout]);

    const loadProfile = () => {
        try {
            const rows = db.exec('SELECT * FROM doctor_profile LIMIT 1');
            if (rows.length > 0) setProfileData(rows[0]);
        } catch (e) {
            console.error(e);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (pwdData.new !== pwdData.confirm) {
            setPwdMsg({ type: 'error', text: 'Las contraseñas no coinciden' });
            return;
        }
        if (pwdData.new.length < 8) {
            setPwdMsg({ type: 'error', text: 'La contraseña debe tener al menos 8 caracteres' });
            return;
        }

        const res = await changePassword(pwdData.current, pwdData.new);
        if (res.ok) {
            setPwdMsg({ type: 'success', text: 'Contraseña actualizada correctamente' });
            setPwdData({ current: '', new: '', confirm: '' });
        } else {
            setPwdMsg({ type: 'error', text: res.error });
        }
    };

    const handleTimerSave = () => {
        let val = parseInt(timerVal, 10);
        if (isNaN(val)) val = 10;
        if (val < 5) val = 5;
        if (val > 60) val = 60;
        updateInactivityTimeout(val);
        setTimerVal(val);
        alert('Configuración guardada');
    };

    return (
        <div className="card config-card" data-testid="config-page">
            {/* <h1 style={{ marginBottom: '20px' }}>Configuración</h1> */}
            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'profile' ? 'tab--active' : ''}`}
                    onClick={() => setActiveTab('profile')}
                    data-testid="config-profile-tab"
                >
                    Perfil
                </button>

                <button
                    className={`tab ${activeTab === 'security' ? 'tab--active' : ''}`}
                    onClick={() => setActiveTab('security')}
                    data-testid="config-security-tab"
                >
                    Seguridad
                </button>
            </div>

            <div>
                {activeTab === 'profile' && (
                    <div className="config-card" style={{ maxWidth: '600px' }}>
                        <DoctorProfileForm initialData={profileData} onSaved={loadProfile} />
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="config-card" style={{ maxWidth: '600px' }}>
                        <h2>Cambiar Contraseña</h2>
                        {pwdMsg.text && (
                            <div style={{
                                padding: '10px',
                                marginBottom: '15px',
                                borderRadius: '4px',
                                backgroundColor: pwdMsg.type === 'error' ? '#fee2e2' : '#dcfce7',
                                color: pwdMsg.type === 'error' ? '#991b1b' : '#166534'
                            }}>
                                {pwdMsg.text}
                            </div>
                        )}
                        <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <label>
                                Contraseña Actual
                                <input
                                    type="password"
                                    value={pwdData.current}
                                    onChange={e => setPwdData({ ...pwdData, current: e.target.value })}
                                    required
                                    data-testid="input-current-password"
                                />
                            </label>
                            <label>
                                Nueva Contraseña
                                <input
                                    type="password"
                                    value={pwdData.new}
                                    onChange={e => setPwdData({ ...pwdData, new: e.target.value })}
                                    required
                                    data-testid="input-new-password"
                                />
                            </label>
                            <label>
                                Confirmar Nueva Contraseña
                                <input
                                    type="password"
                                    value={pwdData.confirm}
                                    onChange={e => setPwdData({ ...pwdData, confirm: e.target.value })}
                                    required
                                    data-testid="input-confirm-password"
                                />
                            </label>
                            <button type="submit" data-testid="btn-change-password">Actualizar Contraseña</button>
                        </form>

                        <hr style={{ margin: '20px 0' }} />
                        <h3>Sesión</h3>
                        <div style={{ marginBottom: '15px' }}>
                            <label htmlFor="inactivity-timer">Tiempo de inactividad (minutos)</label>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <input
                                    id="inactivity-timer"
                                    type="number"
                                    min="5"
                                    max="60"
                                    value={timerVal}
                                    onChange={(e) => setTimerVal(e.target.value)}
                                    data-testid="config-inactivity-timeout"
                                    style={{ width: '100px' }}
                                />
                                <button onClick={handleTimerSave} data-testid="config-save-timer">Guardar</button>
                            </div>
                            <p className="small" style={{ marginTop: '5px' }}>
                                El sistema cerrará la sesión automáticamente después de este tiempo de inactividad (5-60 min).
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
