import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function TopBar() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    return (
        <header style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 20px',
            backgroundColor: 'white',
            borderBottom: '1px solid #e5e7eb',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            marginBottom: '20px'
        }}>
            <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#2563eb' }}>
                <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>Melon Clinic</Link>
            </div>
            <nav style={{ display: 'flex', gap: '20px' }}>
                <Link to="/" style={{ textDecoration: 'none', color: '#4b5563', fontWeight: '500' }}>Inicio</Link>
                <Link to="/config" style={{ textDecoration: 'none', color: '#4b5563', fontWeight: '500' }}>Configuración</Link>
            </nav>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ color: '#374151', fontSize: '0.9rem' }}>{user?.username}</span>
                <button
                    onClick={logout}
                    style={{
                        padding: '5px 10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        background: 'white',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        color: '#374151'
                    }}
                >
                    Salir
                </button>
            </div>
        </header>
    );
}
