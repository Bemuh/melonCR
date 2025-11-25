import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext.jsx';

export default function LoginPage() {
    const { login, createAccount, recoverPassword } = useAuth();
    const [mode, setMode] = useState('login'); // login, create, recover
    const [hasUsers, setHasUsers] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form states
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [recoveryCode, setRecoveryCode] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // Recovery result
    const [generatedRecovery, setGeneratedRecovery] = useState('');

    useEffect(() => {
        checkUsers();
    }, []);

    async function checkUsers() {
        if (window.authApi) {
            const exists = await window.authApi.hasUsers();
            setHasUsers(exists);
            if (!exists) setMode('create');
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (window.logTest) window.logTest(`LoginPage: submit mode=${mode}`);
        console.log(`LoginPage: submit mode=${mode}`);
        setError('');
        setSuccess('');

        if (mode === 'login') {
            const res = await login(username, password);
            if (!res.ok) setError(res.error);
        } else if (mode === 'create') {
            console.log('LoginPage: calling createAccount');
            const res = await createAccount(username, password);
            console.log('LoginPage: createAccount returned', res);
            if (res.ok) {
                console.log('LoginPage: setting recovery code', res.recoveryCode);
                setGeneratedRecovery(res.recoveryCode);
                setSuccess('Cuenta creada exitosamente.');
                console.log('LoginPage: state updated, should show recovery dialog');
                // Don't switch mode immediately, show recovery code first
            } else {
                console.log('LoginPage: createAccount failed', res.error);
                setError(res.error);
            }
        } else if (mode === 'recover') {
            const res = await recoverPassword(username, recoveryCode, newPassword);
            if (res.ok) {
                setSuccess('Contraseña restablecida. Ahora puedes iniciar sesión.');
                setMode('login');
                setPassword('');
                setRecoveryCode('');
                setNewPassword('');
            } else {
                setError(res.error);
            }
        }
    };

    if (generatedRecovery) {
        const handleAck = async () => {
            console.log('LoginPage: user acknowledged recovery code, logging in');
            console.log('LoginPage: credentials - username:', username, 'hasPassword:', !!password);
            // Log the user in now
            const res = await login(username, password);
            console.log('LoginPage: login result:', res);
            if (res.ok) {
                setGeneratedRecovery(''); // This will cause re-render and show main app
            } else {
                setError('Error al iniciar sesión: ' + res.error);
                setGeneratedRecovery(''); // Go back to login screen
                setMode('login');
            }
        };

        return (
            <div className="container" style={{ maxWidth: '500px', marginTop: '50px' }}>
                <div className="card">
                    <h2 style={{ color: 'var(--success)' }}>¡Cuenta Creada!</h2>
                    <p>Por favor guarda este <strong>Código de Recuperación</strong> en un lugar seguro. Lo necesitarás si olvidas tu contraseña.</p>
                    <div style={{
                        background: '#f0fdf4',
                        padding: '15px',
                        border: '1px solid #bbf7d0',
                        borderRadius: '8px',
                        fontFamily: 'monospace',
                        fontSize: '1.1rem',
                        textAlign: 'center',
                        margin: '20px 0',
                        wordBreak: 'break-all'
                    }} data-testid="display-recovery-code">
                        {generatedRecovery}
                    </div>
                    <button onClick={handleAck} data-testid="btn-ack-recovery">
                        Entendido, continuar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container" style={{ maxWidth: '400px', marginTop: '50px' }}>
            <div className="card">
                <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>
                    {mode === 'login' && 'Iniciar Sesión'}
                    {mode === 'create' && 'Crear Cuenta'}
                    {mode === 'recover' && 'Recuperar Contraseña'}
                </h1>

                {error && <div style={{ color: 'var(--danger)', marginBottom: '10px' }} data-testid="auth-error">{error}</div>}
                {success && <div style={{ color: 'var(--success)', marginBottom: '10px' }} data-testid="auth-success">{success}</div>}

                <form onSubmit={handleSubmit}>
                    <label>
                        Usuario
                        <input
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                            data-testid={`input-${mode}-username`}
                        />
                    </label>

                    {mode !== 'recover' && (
                        <label>
                            Contraseña
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                data-testid={`input-${mode}-password`}
                            />
                        </label>
                    )}

                    {mode === 'recover' && (
                        <>
                            <label>
                                Código de Recuperación
                                <input
                                    value={recoveryCode}
                                    onChange={e => setRecoveryCode(e.target.value)}
                                    required
                                    placeholder="XXXX-XXXX-XXXX-XXXX..."
                                    data-testid="input-recovery-code"
                                />
                            </label>
                            <label>
                                Nueva Contraseña
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                    data-testid="input-new-password"
                                />
                            </label>
                        </>
                    )}

                    <button type="submit" style={{ width: '100%', marginTop: '10px' }} data-testid={`btn-${mode}`}>
                        {mode === 'login' && 'Entrar'}
                        {mode === 'create' && 'Crear Cuenta'}
                        {mode === 'recover' && 'Restablecer'}
                    </button>
                </form>

                <hr />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center' }}>
                    {mode === 'login' && (
                        <>
                            <button className="ghost small" onClick={() => setMode('create')} data-testid="link-to-create">
                                Crear nueva cuenta
                            </button>
                            <button className="ghost small" onClick={() => setMode('recover')} data-testid="link-to-recover">
                                Olvidé mi contraseña
                            </button>
                        </>
                    )}

                    {(mode === 'create' || mode === 'recover') && hasUsers && (
                        <button className="ghost small" onClick={() => setMode('login')} data-testid="link-to-login">
                            Volver al inicio de sesión
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
