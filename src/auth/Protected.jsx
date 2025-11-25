import React from 'react';
import { useAuth } from './AuthContext.jsx';
import LoginPage from './LoginPage.jsx';

export default function Protected({ children }) {
    const { user } = useAuth();

    if (!user) {
        return <LoginPage />;
    }

    return children;
}
