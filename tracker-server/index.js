#! /usr/bin/node
const WebSocketServer = require('ws').Server;
const geoip = require('geoip-lite');
const webSocketServer = new WebSocketServer({port: 3001});
const express = require('express');
const jayson = require('jayson');

const MAX_PER_SERVER = 2;
const PEERS = [];
const REGION = 'region';
const COUNTRY = 'country';
const CITY = 'city';
const PORT = 5000;

webSocketServer.on('connection', (ws) => {
  ws.on('message', (message) => {
    peerUrlInfo = JSON.parse(message);
    const peer = Peer.getPeer(ws, peerUrlInfo);
    ws.send(JSON.stringify(peer.getPeerList()));
    console.log(`Added peer node ${peer.url}`);
    console.log(Object.values(PEERS));
    PEERS.push(peer);
  });

  ws.on('close', () => {
    const peer = PEERS.find((peer) => peer.ws === ws);
    const peerIndex = PEERS.indexOf(peer);
    PEERS.splice(peerIndex, 1);
    const effectedPeers = PEERS.filter((p)=> {
      if (p.getPeerList().indexOf(peer.url) > -1) {
        return p;
      }
    });
    let lastPeer = effectedPeers.pop();
    for (i=effectedPeers.length -1; i>=0; i--) {
      lastPeer.connect(effectedPeers[i]);
      lastPeer = effectedPeers.pop();
    }

    // TODO: Connect all nodes that the removed peer was acting as a bridge for in order
    // to ensure that network remains connected at all times
  });
});


class Peer {
  constructor(ws, peerUrlInfo) {
    this.protocol = peerUrlInfo.PROTOCOL;
    this.ip = peerUrlInfo.HOST;
    this.port = peerUrlInfo.P2P_PORT;
    this.url = Peer.getPeerUrl(this.protocol, this.ip, this.port);
    this.ws = ws;
    this.connectedPeers = [];
    const locationDict = Peer.getPeerLoaction(this.ip);
    this.country = locationDict == null || locationDict[COUNTRY].length < 1 ? null : locationDict[COUNTRY];
    this.region = locationDict == null ||locationDict[REGION].length < 1 ? null : locationDict[REGION];
    this.city = locationDict == null ||locationDict[CITY].length < 1 ? null : locationDict[CITY];
  }

  static getPeerLoaction(ip) {
    const geoLocationDict = geoip.lookup(ip);
    if (geoLocationDict === null || (geoLocationDict[COUNTRY] + geoLocationDict[REGION] + geoLocationDict[CITY]).length < 1) {
      return null;
    }
    return {[COUNTRY]: geoLocationDict[COUNTRY], [REGION]: geoLocationDict[REGION], [CITY]: geoLocationDict[CITY]};
  }

  static getPeerUrl(protocol, host, port) {
    return protocol + '://' + host + ':' + port;
  }

  static getPeer(ws, peerInfo) {
    const peer = new Peer(ws, peerInfo);
    if (PEERS.length == 1) {
      peer.addPeer(PEERS[0]);
    } else if (PEERS.length > 1) {
      while (peer.getPeerList() < MAX_PER_SERVER) {
        peer.addPeer(PEERS[Math.floor(Math.random() * PEERS.length)]);
      }
    }

    return peer;
  }

  length() {
    return this.connectedPeers.length;
  }

  addPeer(peer) {
    if (this.connectedPeers.indexOf(peer) > -1) {
      return;
    }
    this.connectedPeers.push(peer);
    peer.addPeer(this);
  }

  removePeer(peer) {
    if (this.connectedPeers.indexOf(peer) < 0) {
      return;
    }
    this.connectedPeers = this.connectedPeers.filter((p) => {
      if (p.url !== peer.url) {
        return p;
      }
    });
    peer.removePeer(this);
  }

  getPeerList() {
    const peerUrls = this.connectedPeers.map((peer) => {
      return peer.url;
    });
    return peerUrls;
  }

  connect(peer) {
    this.ws.send(JSON.stringify([peer.url]));
    this.addPeer(peer);
  }
}

const app = express();
app.use(express.json()); // support json encoded bodies
const jsonRpcMethods = require('./json-rpc')(PEERS);
app.post('/json-rpc', jayson.server(jsonRpcMethods).middleware());
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});
