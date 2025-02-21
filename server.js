const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 3000;

// Configuración de la sesión
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));

// Servir el archivo index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Conexión a la base de datos SQLite
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run("CREATE TABLE messages (id INTEGER PRIMARY KEY, username TEXT, message TEXT)");
  db.run("CREATE TABLE users (username TEXT PRIMARY KEY UNIQUE)");
});

// Manejo de conexiones de Socket.io
io.on('connection', (socket) => {
  console.log('A user connected');

  // Enviar mensajes anteriores al nuevo usuario
  db.all("SELECT username, message FROM messages", (err, rows) => {
    if (err) {
      console.error(err);
      return;
    }
    socket.emit('previousMessages', rows);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });

  socket.on('message', (data) => {
    console.log('Message received from ' + data.username + ': ' + data.message);

    // Guardar el mensaje en la base de datos
    db.run("INSERT INTO messages (username, message) VALUES (?, ?)", [data.username, data.message], (err) => {
      if (err) {
        console.error(err);
        return;
      }
      io.emit('message', data);
    });
  });

  socket.on('register', (username, callback) => {
    db.run("INSERT INTO users (username) VALUES (?)", [username], (err) => {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          callback(false); // El nombre de usuario ya existe
        } else {
          console.error(err);
          callback(false);
        }
        return;
      }
      callback(true); // Registro exitoso
    });
  });
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});