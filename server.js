const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

// État du jeu en mémoire
let planets = [];

// Génère 60 planètes au démarrage
function generateGalaxy() {
  planets = [];
  for (let i = 0; i < 60; i++) {
    planets.push({
      id: i,
      x: Math.random() * 1800 + 100,
      y: Math.random() * 1800 + 100,
      owner: 'neutre',
      resources: {
        metal: Math.floor(400 + Math.random() * 1200),
        energy: Math.floor(150 + Math.random() * 700)
      },
      army: Math.floor(15 + Math.random() * 100)
    });
  }
  console.log('🌌 Galaxie générée avec 60 planètes !');
}
generateGalaxy();

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Fallback pour toutes les routes (évite le 404)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io
io.on('connection', (socket) => {
  console.log('🚀 Joueur connecté:', socket.id);
  socket.emit('galaxy', planets);

  socket.on('conquer', (planetId) => {
    const planet = planets.find(p => p.id === planetId);
    if (planet && planet.owner === 'neutre') {
      planet.owner = socket.id;
      planet.army = Math.max(0, planet.army - 25);
      console.log(`Planète ${planetId} conquise par ${socket.id}`);
      io.emit('galaxy', planets);
    }
  });

  socket.on('disconnect', () => {
    console.log('Joueur déconnecté:', socket.id);
  });
});

// Tick ressources toutes les 60 secondes
setInterval(() => {
  planets.forEach(p => {
    if (p.owner !== 'neutre') {
      p.resources.metal += 12;
      p.resources.energy += 7;
    }
  });
  io.emit('galaxy', planets);
  console.log('⏰ Tick ressources appliqué');
}, 60000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌟 Serveur lancé sur le port ${PORT}`);
});
