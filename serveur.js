const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

// Connect DB (remplace par ton Atlas URI gratuit : mongodb+srv://user:pass@cluster.mongodb.net/cosmos)
mongoose.connect('mongodb://localhost:27017/cosmos', { useNewUrlParser: true, useUnifiedTopology: true });

// Schéma simple Planète
const PlanetSchema = new mongoose.Schema({
  id: Number,
  x: Number, y: Number,
  owner: String, // 'neutre' ou playerId
  resources: { metal: Number, energy: Number },
  army: Number
});
const Planet = mongoose.model('Planet', PlanetSchema);

// Génère galaxie au démarrage (100 planètes)
async function generateGalaxy() {
  const count = await Planet.countDocuments();
  if (count === 0) {
    for (let i = 0; i < 100; i++) {
      const planet = new Planet({
        id: i,
        x: Math.random() * 2000,
        y: Math.random() * 2000,
        owner: 'neutre',
        resources: { metal: 100 + Math.random() * 900, energy: 50 + Math.random() * 450 },
        army: 10 + Math.random() * 90
      });
      await planet.save();
    }
    console.log('🌌 Galaxie générée !');
  }
}
generateGalaxy();

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Socket : updates real-time
io.on('connection', (socket) => {
  console.log('🚀 Joueur connecté');

  // Envoie galaxie actuelle
  Planet.find({}).then(planets => socket.emit('galaxyUpdate', planets));

  socket.on('conquer', async (data) => {
    // Simule conquête simple (à améliorer avec flottes/army)
    const planet = await Planet.findOne({ id: data.id });
    if (planet) {
      planet.owner = socket.id; // Ton empire
      planet.army -= 20; // Perte
      await planet.save();
      io.emit('galaxyUpdate', await Planet.find({})); // Broadcast à tous
    }
  });

  // Tick toutes les 60s : prod ressources
  setInterval(async () => {
    const planets = await Planet.find({});
    planets.forEach(async p => {
      if (p.owner !== 'neutre') {
        p.resources.metal += 10;
        p.resources.energy += 5;
        await p.save();
      }
    });
    io.emit('tick', { time: Date.now() });
  }, 60000);
});

server.listen(3000, () => console.log('🌟 Serveur sur http://localhost:3000'));
