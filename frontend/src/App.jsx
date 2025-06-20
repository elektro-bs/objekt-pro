// src/App.jsx
import React from 'react';
import LoginForm from './components/LoginForm';

function App() {
    const handleLogin = (data) => {
        console.log("Login erfolgreich:", data);
        // hier z. B. Token speichern oder Redirect machen
    };

    return (
        <div>
            <LoginForm onLogin={handleLogin} />
        </div>
    );
}

export default App;
