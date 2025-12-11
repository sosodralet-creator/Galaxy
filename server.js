const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' }
});

// État du jeu en mémoire (se réinitialise au redémarrage)
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

// Servir les fichiers statiques (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Fallback pour toutes les routes → index.html (important pour éviter 404)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io - communication temps réel
io.on('connection', (socket) => {
  console.log('🚀 Joueur connecté:', socket.id);

  // Envoie la galaxie au nouveau joueur
  socket.emit('galaxy', planets);

  // Conquête d'une planète
  socket.on('conquer', (planetId) => {
    const planet = planets.find(p => p.id === planetId);
    if (planet && planet.owner === 'neutre') {
      planet.owner = socket.id;
      planet.army = Math.max(0, planet.army - 25); // Bataille simulée
      console.log(`Planète ${planetId} conquise par ${socket.id}`);
      io.emit('galaxy', planets); // Broadcast à tous
    }
  });

  socket.on('disconnect', () => {
    console.log('Joueur déconnecté:', socket.id);
  });
});

// Tick toutes les 60 secondes : production de ressources
setInterval(() => {
  planets.forEach(p => {
    if (p.owner !== 'neutre') {
      p.resources.metal += 12;
      p.resources.energy += 7;
    }
  });
  io.emit('galaxy', planets); // Met à jour tout le monde
  console.log('⏰ Tick ressources appliqué');
}, 60000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0
