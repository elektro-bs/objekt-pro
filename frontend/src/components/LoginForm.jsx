// src/components/LoginForm.jsx
import React, { useState } from 'react';

export default function LoginForm({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                throw new Error('Login fehlgeschlagen');
            }

            const data = await response.json();
            setStatus('success');
            onLogin(data); // z. B. speichere Token oder leite weiter
        } catch (err) {
            console.error(err);
            setStatus('error');
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2>Login</h2>
            <input
                type="email"
                placeholder="E-Mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
            />
            <br />
            <input
                type="password"
                placeholder="Passwort"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
            />
            <br />
            <button type="submit">Anmelden</button>
            {status === 'loading' && <p>⏳ Prüfe Zugangsdaten…</p>}
            {status === 'error' && <p style={{ color: 'red' }}>❌ Login fehlgeschlagen</p>}
            {status === 'success' && <p style={{ color: 'green' }}>✅ Erfolgreich eingeloggt</p>}
        </form>
    );
}
