var port = 7890
var nodeStatic = require('node-static');
var http = require('http')
var socketIO = require('socket.io');
const robot = require('robotjs')
var screenSize = robot.getScreenSize();
const open = require('open');
var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function (req, res) {
  fileServer.serve(req, res);

  let query = req.url.split('?')[1]
  if (query) {
    let mouse = JSON.parse(decodeURIComponent(query))
    if (mouse.x !== undefined) {
      // robot.moveMouse(mouse.x * screenSize.width, mouse.y * screenSize.height);
      robot.moveMouse(mouse.x, mouse.y);
    }

    if (mouse.click) {
      robot.mouseClick()
    }
    res.end('ok');
  }


}).listen(port);

var io = socketIO.listen(app);

open(`http://localhost:${port}/controllee/`);