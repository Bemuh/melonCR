import React, { useState } from 'react';

export default function DbDiscovery({ onConfigured }) {
    const [error, setError] = useState(null);

    const handleSelect = async () => {
        try {
            const path = await window.configApi.selectFolder();
            if (path) {
                const res = await window.configApi.setDbPath(path);
                if (res.ok) {
                    onConfigured();
                } else {
                    setError(res.error);
                }
            }
        } catch (e) {
            setError("Error seleccionando carpeta: " + e.message);
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: '#f3f4f6',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: '2.5rem',
                borderRadius: '0.75rem',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                maxWidth: '450px',
                width: '100%',
                textAlign: 'center'
            }}>
                <h1 style={{ marginBottom: '1rem', color: '#111827', fontSize: '1.5rem', fontWeight: 'bold' }}>Bienvenido</h1>
                <p style={{ marginBottom: '2rem', color: '#4b5563', lineHeight: '1.5' }}>
                    Para comenzar, selecciona la carpeta donde se almacenarán los datos de la clínica.
                </p>
                <button
                    onClick={handleSelect}
                    style={{
                        backgroundColor: '#22c55e',
                        color: 'white',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: '600',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#16a34a'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#22c55e'}
                >
                    Seleccionar Carpeta de Datos
                </button>
                {error && (
                    <div style={{
                        marginTop: '1.5rem',
                        padding: '0.75rem',
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                    }}>
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
