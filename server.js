const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

let planets = [];
let fleets = [];

function generateGalaxy() {
  planets = [];
  planets.push({ id: 0, name: "Terre", x: 960, y: 540, owner: null, isHome: true, resources: { metal: 2000, energy: 1500 }, buildings: { mine: 5, power: 5, lab: 3, shipyard: 1 }, research: { spaceTravel: true } });
  for (let i = 1; i < 40; i++) {
    planets.push({ id: i, name: `Système ${i}`, x: Math.random() * 1600 + 160, y: Math.random() * 800 + 100, owner: 'neutre', resources: { metal: 500 + Math.random() * 1500, energy: 300 + Math.random() * 1000 }, army: 30 + Math.random() * 70 });
  }
  console.log('🌌 V4 Galaxie générée – esthétique et gameplay immersif !');
}
generateGalaxy();

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

io.on('connection', (socket) => {
  socket.emit('galaxyUpdate', { planets, fleets });

  if (planets[0].owner === null) planets[0].owner = socket.id;

  socket.on('build', (data) => {
    const planet = planets.find(p => p.id === data.planetId);
    if (planet && planet.owner === socket.id) {
      planet.buildings[data.building] = (planet.buildings[data.building] || 0) + 1;
      if (planet.buildings.lab >= 5) planet.research.spaceTravel = true;
      io.emit('galaxyUpdate', { planets, fleets });
    }
  });

  socket.on('sendFleet', (data) => {
    const from = planets.find(p => p.id === data.from);
    const to = planets.find(p => p.id === data.to);
    if (from && from.owner === socket.id && from.research.spaceTravel && from.buildings.shipyard >= 1 && from !== to) {
      fleets.push({ id: fleets.length, from: data.from, to: data.to, ships: 100, progress: 0, owner: socket.id });
      io.emit('galaxyUpdate', { planets, fleets });
    }
  });
});

// Tick
setInterval(() => {
  planets.forEach(p => {
    if (p.owner) {
      p.resources.metal += (p.buildings.mine || 0) * 15;
      p.resources.energy += (p.buildings.power || 0) * 12;
    }
  });

  fleets = fleets.filter(f => {
    f.progress += 2;
    if (f.progress >= 100) {
      const target = planets.find(p => p.id === f.to);
      if (target.army < f.ships) {
        target.owner = f.owner;
        target.army = f.ships - target.army;
      } else {
        target.army -= f.ships;
      }
      return false;
    }
    return true;
  });

  io.emit('galaxyUpdate', { planets, fleets });
}, 500);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`🌟 V4 lancée – BEAUCOUP MOINS MOCHE ET PLUS FUN !`));
