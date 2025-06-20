const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: 'Anlagen-Route bereit',
    anlagen: [],
    status: '⏳ noch nicht implementiert'
  });
});

router.post('/', (req, res) => {
  res.json({
    message: 'Anlage-Erstellung bereit',
    status: '⏳ noch nicht implementiert'
  });
});

router.get('/test', (req, res) => {
  res.json({
    anlagen: '✅ Anlagen-System bereit',
    routes: ['GET /', 'POST /', 'GET /test']
  });
});

module.exports = router;