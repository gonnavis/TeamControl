# TeamControl

Visual Desktop Remote Control Application based on WebRTC


## On the computer to be controlled

```

npm install

node controllee/

```
Will auto open http://localhost:7890/controllee/ in your default browser.

Then prompt you to type a room name, enter an arbitrary name you prefer.

And prompt you to choose what screen part to share, choose the "your whole screen" and click "share" button.

## On the computer to controll

Open browser (recommend Chrome) and access <del>https://www.gonnavis.com/controller/</del> ( I'm sorry that the server is not maintened recently, maybe re-maintained in the future. But you can run the server yourself, see below ).

Then enter the room name you named before.

OK, you can remote controll the mouse position!




## If you want run the server yourself, on the server

```

npm install

node server/

```
May need some code replace from "gonnavis.com" to "your domain". And note that WebRTC need https server.

## Similar Projects

https://github.com/pavlobu/deskreen

https://github.com/jeremija/remote-control-server

https://github.com/mafintosh/signalhub

https://github.com/mafintosh/webrtc-swarm

## Relative Tutorials

https://mp.weixin.qq.com/s/97dY9kfeXASovn8k3rfy9A
