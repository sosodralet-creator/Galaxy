const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

// MongoDB (ajoute ta URI dans env vars Dokploy)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cosmos');

// Schéma Planète (simplifié)
const PlanetSchema = new mongoose.Schema({
  id: Number, x: Number, y: Number, owner: String, resources: { metal: Number, energy: Number }
});
const Planet = mongoose.model('Planet', PlanetSchema);

// Génère galaxie si vide
async function initGalaxy() {
  if (await Planet.countDocuments() === 0) {
    for (let i = 0; i < 50; i++) {
      new Planet({ id: i, x: Math.random()*2000, y: Math.random()*2000, owner: 'neutre', resources: { metal: 500, energy: 200 } }).save();
    }
  }
}
initGalaxy();

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log('Joueur connecté');
  Planet.find().then(planets => socket.emit('galaxy', planets));
  socket.on('conquer', async (id) => {
    await Planet.updateOne({ id }, { owner: socket.id });
    io.emit('galaxy', await Planet.find());
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Serveur sur port ${PORT}`));
