'use strict';

var nodeStatic = require('node-static');
var https = require('https')
var fs=require('fs')
var socketIO = require('socket.io');
var options = {
  key: fs.readFileSync('2279791_gonnavis.com.key'),
  cert: fs.readFileSync('2279791_gonnavis.com.pem'),
}
var fileServer = new(nodeStatic.Server)();
var app = https.createServer(options,function(req, res) {
  fileServer.serve(req, res);
}).listen(443);

var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {

  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(message) {
    log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)
    socket.broadcast.emit('message', message);
  });

  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);

    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      socket.join(room);
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);

    } else if (numClients === 1) {
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } else { // max two clients
      socket.emit('full', room);
    }
  });

  socket.on('bye', function(){
    console.log('received bye');
  });

  socket.on('mouse', function (mouse) {
    socket.emit('mouse', mouse);
  });

});
