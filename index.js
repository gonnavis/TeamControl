// https://electronjs.org/docs/api/desktop-capturer

var express = require('express')
var app = express();
app.use(express.static('public'))
var http = require('http').createServer(app);
var io = require('socket.io')(http);
const robot = require('robotjs')
var screenSize = robot.getScreenSize();


app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function (socket) {
  console.log('a user connected');
  socket.on('chat message', function (msg) {
    console.log('message: ' + msg);
    msg = JSON.parse(msg)
    if (msg.x !== undefined) {
      robot.moveMouse(msg.x * screenSize.width, msg.y * screenSize.height);
    }

    if (msg.click) {
      robot.mouseClick()
    }
  });
});

http.listen(3000, function () {
  console.log('listening on *:3000');
});