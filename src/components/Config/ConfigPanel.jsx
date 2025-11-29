import React, { useState, useEffect } from 'react';
import DoctorProfileForm from '../Auth/DoctorProfileForm.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import db from '../../db/index.js';
import Modal from '../Modal.jsx';

const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);

const EyeOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
);

export default function ConfigPanel() {
    const { changePassword, inactivityTimeout, updateInactivityTimeout } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [profileData, setProfileData] = useState(null);

    // Password state
    const [pwdData, setPwdData] = useState({ current: '', new: '', confirm: '' });
    const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });
    const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false });

    // Timer state
    const [timerVal, setTimerVal] = useState(10);

    // Modal state
    const [modal, setModal] = useState({
        open: false,
        title: "",
        content: "",
        onConfirm: null,
        onCancel: null,
    });

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

    const toggleShowPwd = (field) => {
        setShowPwd(prev => ({ ...prev, [field]: !prev[field] }));
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

        setModal({
            open: true,
            title: "Configuración guardada",
            content: "Configuración de sesión guardada correctamente.",
            onConfirm: () => setModal({ ...modal, open: false })
        });
    };

    return (
        <div className="card config-card" data-testid="config-page">
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
                    <div className="config-section-wrapper">
                        <DoctorProfileForm initialData={profileData} onSaved={loadProfile} />
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="config-section-wrapper">
                        <div className="config-section-card">
                            <h2 style={{ marginBottom: '20px', color: 'var(--primary)' }}>Cambiar Contraseña</h2>
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
                                    <div className="password-wrapper">
                                        <input
                                            type={showPwd.current ? "text" : "password"}
                                            value={pwdData.current}
                                            onChange={e => setPwdData({ ...pwdData, current: e.target.value })}
                                            required
                                            data-testid="input-current-password"
                                        />
                                        <button type="button" className="icon-button" onClick={() => toggleShowPwd('current')} data-testid="toggle-password-current">
                                            {showPwd.current ? <EyeOffIcon /> : <EyeIcon />}
                                        </button>
                                    </div>
                                </label>
                                <label>
                                    Nueva Contraseña
                                    <div className="password-wrapper">
                                        <input
                                            type={showPwd.new ? "text" : "password"}
                                            value={pwdData.new}
                                            onChange={e => setPwdData({ ...pwdData, new: e.target.value })}
                                            required
                                            data-testid="input-new-password"
                                        />
                                        <button type="button" className="icon-button" onClick={() => toggleShowPwd('new')} data-testid="toggle-password-new">
                                            {showPwd.new ? <EyeOffIcon /> : <EyeIcon />}
                                        </button>
                                    </div>
                                </label>
                                <label>
                                    Confirmar Nueva Contraseña
                                    <div className="password-wrapper">
                                        <input
                                            type={showPwd.confirm ? "text" : "password"}
                                            value={pwdData.confirm}
                                            onChange={e => setPwdData({ ...pwdData, confirm: e.target.value })}
                                            required
                                            data-testid="input-confirm-password"
                                        />
                                        <button type="button" className="icon-button" onClick={() => toggleShowPwd('confirm')} data-testid="toggle-password-confirm">
                                            {showPwd.confirm ? <EyeOffIcon /> : <EyeIcon />}
                                        </button>
                                    </div>
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
                    </div>
                )}
            </div>

            {modal.open && (
                <Modal
                    title={modal.title}
                    onClose={modal.onConfirm}
                    onCancel={modal.onCancel}
                >
                    {modal.content}
                </Modal>
            )}
        </div>
    );
}
