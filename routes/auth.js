// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Pfad zu deiner DB-Verbindung
const bcrypt = require('bcrypt');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'E-Mail nicht gefunden' });
    }

    const user = rows[0];

    // ✅ Passwort prüfen (bcrypt)
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Falsches Passwort' });
    }

    // ✅ Erfolgreich – Antwort senden
    res.json({
      success: true,
      message: 'Login erfolgreich',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
      },
    });

  } catch (err) {
    console.error('Login-Fehler:', err);
    res.status(500).json({ message: 'Serverfehler beim Login' });
  }
});

module.exports = router;
