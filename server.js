const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

// Stockage en mémoire (plus tard JSON file si tu veux persistance)
const users = {}; // { username: { hash, empire: 'France', color: '#002395' } }
const players = {}; // socket.id -> data joueur
const planets = [];

// Génère la galaxie (Terre au centre + 80 planètes)
function generateGalaxy() {
  planets.length = 0;
  // Terre au centre
  planets.push({
    id: 0,
    name: "Terre",
    x: 1000, y: 540,
    owner: null, // Sera assigné au joueur
    isHome: true,
    resources: { metal: 1000, energy: 800 },
    buildings: { mine: 1, power: 1, lab: 0, shipyard: 0 },
    research: { spaceTravel: false }
  });
  for (let i = 1; i < 81; i++) {
    planets.push({
      id: i,
      name: `Planète ${i}`,
      x: Math.random() * 1800 + 100,
      y: Math.random() * 900 + 100,
      owner: 'neutre',
      isHome: false,
      resources: { metal: Math.floor(300 + Math.random() * 1000), energy: Math.floor(200 + Math.random() * 600) },
      buildings: {},
      research: {}
    });
  }
  console.log('🌍 Galaxie V2 générée avec Terre au centre !');
}
generateGalaxy();

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Socket.io
io.on('connection', (socket) => {
  console.log('Nouvelle connexion:', socket.id);

  // Inscription / Connexion
  socket.on('register', async (data) => {
    if (users[data.username]) {
      socket.emit('registerFail', 'Pseudo déjà pris');
    } else {
      const hash = await bcrypt.hash(data.password, 10);
      users[data.username] = { hash, empire: data.empire, color: data.color };
      socket.emit('loginSuccess', { username: data.username, empire: data.empire, color: data.color });
    }
  });

  socket.on('login', async (data) => {
    const user = users[data.username];
    if (user && await bcrypt.compare(data.password, user.hash)) {
      socket.emit('loginSuccess', { username: data.username, empire: user.empire, color: user.color });
    } else {
      socket.emit('loginFail', 'Mauvais pseudo/mot de passe');
    }
  });

  // Joueur connecté
  socket.on('playerReady', (playerData) => {
    players[socket.id] = playerData;
    // Assigne la Terre au joueur si première connexion
    if (planets[0].owner === null) {
      planets[0].owner = socket.id;
      planets[0].name = `${playerData.empire} (Terre)`;
    }
    socket.emit('galaxyUpdate', planets);
    io.emit('playersUpdate', Object.values(players));
  });

  // Actions bâtiment
  socket.on('build', (data) => {
    const planet = planets.find(p => p.id === data.planetId);
    if (planet && planet.owner === socket.id) {
      if (!planet.buildings) planet.buildings = {};
      planet.buildings[data.building] = (planet.buildings[data.building] || 0) + 1;
      io.emit('galaxyUpdate', planets);
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    console.log('Déconnexion');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`🌟 Soso Galaxy Conquest V2 lancé sur port ${PORT}`));
