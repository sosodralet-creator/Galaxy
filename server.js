const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Liste des pays disponibles (tu peux en ajouter autant que tu veux)
const availableCountries = [
  "France", "États-Unis", "Chine", "Russie", "Brésil",
  "Inde", "Japon", "Allemagne", "Canada", "Royaume-Uni",
  "Australie", "Mexique", "Italie", "Corée du Sud", "Argentine",
  // Ajoute-en d'autres ici...
];

// État du jeu : qui a pris quel pays
const takenCountries = new Map(); // socket.id -> country
const players = new Map();        // socket.id -> { country, name? }

app.use(express.static(path.join(__dirname, 'public'))); // Changé pour public

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html')); // Changé pour public/index.html
});

// Quand un joueur se connecte
io.on('connection', (socket) => {
  console.log(`Joueur connecté : ${socket.id}`);

  // Envoie la liste actuelle des pays pris
  const takenList = Object.fromEntries(takenCountries);
  socket.emit('countries-update', takenList);

  // Quand un joueur choisit un pays
  socket.on('choose-country', (country) => {
    // Vérifie si le pays est déjà pris
    if (takenCountries.has(country)) {
      socket.emit('country-rejected', { country, reason: 'already-taken' });
      return;
    }

    // Vérifie si le pays existe
    if (!availableCountries.includes(country)) {
      socket.emit('country-rejected', { country, reason: 'invalid' });
      return;
    }

    // Libère l'ancien pays du joueur s'il en avait un (changement d'avis)
    if (players.has(socket.id)) {
      const oldCountry = players.get(socket.id).country;
      takenCountries.delete(oldCountry);
      io.emit('country-freed', oldCountry);
    }

    // Attribue le pays
    takenCountries.set(country, socket.id);
    players.set(socket.id, { country });

    console.log(`${socket.id} a pris ${country}`);

    // Informe tout le monde
    io.emit('country-taken', { country, playerId: socket.id });

    // Confirme au joueur
    socket.emit('country-accepted', { country });
  });

  // Quand un joueur se déconnecte
  socket.on('disconnect', () => {
    console.log(`Joueur déconnecté : ${socket.id}`);

    if (players.has(socket.id)) {
      const { country } = players.get(socket.id);
      takenCountries.delete(country);
      players.delete(socket.id);

      // Informe les autres que le pays est libre
      io.emit('country-freed', country);
      console.log(`${country} est maintenant libre`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`Ouvre cette adresse dans plusieurs onglets/navigateurs pour tester le multijoueur !`);
});
