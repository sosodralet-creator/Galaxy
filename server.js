const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

let planets = [];
let fleets = []; // { id, fromPlanet, toPlanet, ships: 50, progress: 0, owner }

function generateGalaxy() {
  planets = [];
  // Terre
  planets.push({ id: 0, name: "Terre", x: 960, y: 540, owner: null, isHome: true, resources: { metal: 1000, energy: 800 }, buildings: { mine: 1, power: 1, lab: 0, shipyard: 0 }, research: { spaceTravel: false } });
  for (let i = 1; i < 50; i++) {
    planets.push({ id: i, name: `Planète ${i}`, x: Math.random() * 1800 + 100, y: Math.random() * 900 + 100, owner: 'neutre', resources: { metal: Math.random() * 1000, energy: Math.random() * 600 }, army: 50 });
  }
  console.log('🌌 Galaxie V3 générée – esthétique et gameplay améliorés !');
}
generateGalaxy();

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

io.on('connection', (socket) => {
  socket.emit('galaxyUpdate', { planets, fleets });

  socket.on('build', (data) => {
    const planet = planets.find(p => p.id === data.planetId);
    if (planet && planet.owner === socket.id) {
      planet.buildings[data.building] = (planet.buildings[data.building] || 0) + 1;
      if (data.building === 'lab' && planet.buildings.lab >= 5) planet.research.spaceTravel = true;
      io.emit('galaxyUpdate', { planets, fleets });
    }
  });

  socket.on('sendFleet', (data) => {
    const from = planets.find(p => p.id === data.from);
    if (from && from.owner === socket.id && from.research.spaceTravel && from.buildings.shipyard >= 1) {
      fleets.push({ id: fleets.length, from: data.from, to: data.to, ships: 50, progress: 0, owner: socket.id });
      io.emit('galaxyUpdate', { planets, fleets });
    }
  });

  // Assign Terre
  if (planets[0].owner === null) planets[0].owner = socket.id;
});

// Tick : production + mouvement flottes
setInterval(() => {
  // Production
  planets.forEach(p => {
    if (p.owner) {
      p.resources.metal += (p.buildings.mine || 0) * 10;
      p.resources.energy += (p.buildings.power || 0) * 8;
    }
  });

  // Mouvement flottes
  fleets.forEach(f => {
    f.progress += 0.5; // Avance
    if (f.progress >= 100) {
      const target = planets.find(p => p.id === f.to);
      if (target.army < f.ships) {
        target.owner = f.owner;
        target.army = f.ships - target.army;
      } else {
        target.army -= f.ships;
      }
      fleets = fleets.filter(fl => fl.id !== f.id);
    }
  });

  io.emit('galaxyUpdate', { planets, fleets });
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`🌟 V3 lancée – esthétique et gameplay au top !`));
