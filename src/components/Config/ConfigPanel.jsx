import React, { useState, useEffect } from 'react';
import DoctorProfileForm from '../Auth/DoctorProfileForm.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import db from '../../db/index.js';

export default function ConfigPanel() {
    const { changePassword } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [profileData, setProfileData] = useState(null);

    // Password state
    const [pwdData, setPwdData] = useState({ current: '', new: '', confirm: '' });
    const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });

    useEffect(() => {
        loadProfile();
    }, []);

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

    return (
        <div className="container" style={{ padding: '20px' }}>
            <h1 style={{ marginBottom: '20px' }}>Configuración</h1>
            <div className="tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button
                    className={activeTab === 'profile' ? 'active' : ''}
                    onClick={() => setActiveTab('profile')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        borderBottom: activeTab === 'profile' ? '2px solid var(--primary)' : '2px solid transparent',
                        background: 'none',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'profile' ? 'bold' : 'normal'
                    }}
                >
                    Perfil
                </button>
                <button
                    className={activeTab === 'security' ? 'active' : ''}
                    onClick={() => setActiveTab('security')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        borderBottom: activeTab === 'security' ? '2px solid var(--primary)' : '2px solid transparent',
                        background: 'none',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'security' ? 'bold' : 'normal'
                    }}
                >
                    Seguridad
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'profile' && (
                    <DoctorProfileForm initialData={profileData} onSaved={loadProfile} />
                )}

                {activeTab === 'security' && (
                    <div className="card" style={{ maxWidth: '500px' }}>
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
                                />
                            </label>
                            <label>
                                Nueva Contraseña
                                <input
                                    type="password"
                                    value={pwdData.new}
                                    onChange={e => setPwdData({ ...pwdData, new: e.target.value })}
                                    required
                                />
                            </label>
                            <label>
                                Confirmar Nueva Contraseña
                                <input
                                    type="password"
                                    value={pwdData.confirm}
                                    onChange={e => setPwdData({ ...pwdData, confirm: e.target.value })}
                                    required
                                />
                            </label>
                            <button type="submit">Actualizar Contraseña</button>
                        </form>

                        <hr style={{ margin: '20px 0' }} />
                        <h3>Sesión</h3>
                        <p style={{ color: '#666' }}>El cierre de sesión automático está activado (5 minutos de inactividad).</p>
                    </div>
                )}
            </div>
        </div>
    );
}
