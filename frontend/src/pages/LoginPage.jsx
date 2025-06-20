// src/pages/LoginPage.jsx
import React from 'react';
import LoginForm from '../components/LoginForm';

export default function LoginPage() {
    const handleLogin = (data) => {
        console.log('Erfolgreich eingeloggt:', data);
        // TODO: z. B. Token speichern oder zur Startseite weiterleiten
    };

    return (
        <div>
            <h1>Benutzer-Login</h1>
            <LoginForm onLogin={handleLogin} />
        </div>
    );
}
