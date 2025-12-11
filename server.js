const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

// === État du jeu en mémoire (se réinitialise au redémarrage) ===
let planets = [];

// Génère 50 planètes au démarrage
function generateGalaxy() {
  planets = [];
  for (let i = 0; i < 50; i++) {
    planets.push({
      id: i,
      x: Math.random() * 1800 + 100,
      y: Math.random() * 1800 + 100,
      owner: 'neutre',
      resources: {
        metal: Math.floor(500 + Math.random() * 1000),
        energy: Math.floor(200 + Math.random() * 600)
      },
      army: Math.floor(20 + Math.random() * 80)
    });
  }
  console.log('🌌 Galaxie générée avec 50 planètes !');
}
generateGalaxy();

// Servir les fichiers statiques (le frontend Phaser)
app.use(express.static(path.join(__dirname, 'public')));

// Route racine au cas où
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === Socket.io : communication en temps réel ===
io.on('connection', (socket) => {
  console.log('🚀 Joueur connecté:', socket.id);

  // Envoie la galaxie actuelle au nouveau joueur
  socket.emit('galaxy', planets);

  // Réception d'une conquête
  socket.on('conquer', (planetId) => {
    const planet = planets.find(p => p.id === planetId);
    if (planet) {
      planet.owner = socket.id; // Ou un pseudo plus tard
      planet.army = Math.max(0, planet.army - 20); // Simule une bataille
      console.log(`Planète ${planetId} conquise par ${socket.id}`);
      // Broadcast à tous les joueurs
      io.emit('galaxy', planets);
    }
  });

  socket.on('disconnect', () => {
    console.log('Joueur déconnecté:', socket.id);
  });
});

// Tick toutes les 60 secondes : production de ressources pour les planètes possédées
setInterval(() => {
  planets.forEach(p => {
    if (p.owner !== 'neutre') {
      p.resources.metal += 10;
      p.resources.energy += 5;
    }
  });
  io.emit('tick', planets); // Optionnel : envoie l'état mis à jour
}, 60000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌟 Serveur lancé sur le port ${PORT}`);
  console.log(`Ouvre ton lien : https://soso-galaxy-conquest-6bvadn.api.dokploy.com`);
});
