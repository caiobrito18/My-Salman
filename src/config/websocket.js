const app = require('./express');
const WebSocket = require('ws');
const http = require('http');
const disparoSocket = require('../api/socket/socket');
const logger = require('pino')();
const WSserver = http.createServer(app);
const wss = new WebSocket.Server({server:WSserver});

wss.on('connection', disparoSocket);

module.exports = WSserver;