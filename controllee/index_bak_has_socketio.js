
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
}).listen(port);

var io = socketIO.listen(app);

open(`http://localhost:${port}/controllee/`);