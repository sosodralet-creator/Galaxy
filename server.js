const express = require('express');
socket.on('build_launcher', () => {
const p = players[socket.id]; if (!p) return;
const cost = 200;
if (p.resources < cost) {
socket.emit('error_msg', 'Pas assez de ressources pour construire un lanceur (200).');
return;
}
p.resources -= cost;
p.buildQueue.push({ type: 'launcher', remaining: 10 }); // 10s build
sendStateToAll();
});


socket.on('start_research', (key) => {
const p = players[socket.id]; if (!p) return;
if (!RESEARCH[key]) return;
if (p.currentResearch) { socket.emit('error_msg', 'Déjà en recherche.'); return; }
const time = RESEARCH[key].baseTime / (1 + (p.research[key]||0)*0.25); // faster with levels
const cost = 150;
if (p.resources < cost) { socket.emit('error_msg', 'Pas assez de ressources pour la recherche (150).'); return; }
p.resources -= cost;
p.currentResearch = { key, remaining: time };
sendStateToAll();
});


socket.on('launch_rocket', ({ fromPlanetId, targetPlanetId }) => {
const p = players[socket.id]; if (!p) return;
if (p.launchers <= 0) { socket.emit('error_msg', 'Vous n\'avez pas de lanceur.'); return; }
const from = PLANETS.find(pl=>pl.id===fromPlanetId);
const to = PLANETS.find(pl=>pl.id===targetPlanetId);
if (!from || !to) return;
// cost/time depend on distance and research
const d = distance(from, to);
const baseDuration = Math.max(5, Math.round(d/100 * 20));
const propulsionLevel = p.research.rocket_propulsion || 0;
const duration = Math.max(3, baseDuration - propulsionLevel*2);
const rocket = {
id: 'R' + Date.now() + Math.floor(Math.random()*1000),
owner: p.id,
origin: from.id,
target: to.id,
startTime: Date.now(),
duration: duration,
progress: 0
};
rockets.push(rocket);
sendStateToAll();
});


socket.on('disconnect', () => {
console.log('disconnect', socket.id);
delete players[socket.id];
sendStateToAll();
});
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server running on port', PORT));
