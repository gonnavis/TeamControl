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
    let input = JSON.parse(decodeURIComponent(query))
    console.log('input', input)
    switch (input.type) {
      case 'mousemove':
        robot.moveMouse(input.x * screenSize.width, input.y * screenSize.height)
        break
      case 'mousedown':
        switch (input.button) {
          case 0:
            robot.mouseToggle('down')
            break
          case 1:
            robot.mouseToggle('down', 'middle')
            break
          case 2:
            robot.mouseToggle('down', 'right')
            break
        }
        break
      case 'mouseup':
        switch (input.button) {
          case 0:
            robot.mouseToggle('up')
            break
          case 1:
            robot.mouseToggle('up', 'middle')
            break
          case 2:
            robot.mouseToggle('up', 'right')
            break
        }
        break
      case 'mousewheel':
        robot.scrollMouse(input.x, input.y)
        break
      case 'keydown':
        try {
          mapKey(input)
          robot.keyToggle(input.key, 'down')
        } catch (e) {
          console.log(e)
        }
        break
      case 'keyup':
        try {
          mapKey(input)
          robot.keyToggle(input.key, 'up')
        } catch (e) {
          console.log(e)
        }
        break
    }
    res.end('ok');
  }


}).listen(port);

var io = socketIO.listen(app);

open(`http://localhost:${port}/controllee/`);



function mapKey(input) {
  input.key = input.key.toLowerCase()
  switch (input.key) {
    case 'arrowup':
      input.key = 'up'
      break
    case 'arrowdown':
      input.key = 'down'
      break
    case 'arrowleft':
      input.key = 'left'
      break
    case 'arrowright':
      input.key = 'right'
      break
  }
}