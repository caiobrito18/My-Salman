const logger = require('pino')();

const disparoSocket = (ws) => {
  logger.info(`ID: ${ws.id} entrou`);
  //connection is up, let's add a simple simple event
  ws.on('message', (message) => {

    //log the received message and send it back to the client
    logger.info('received: %s', message);
    ws.send(`Hello, you sent -> ${message}`);
    ws.emit('test', ['number are shown'], function(data){
      console.log(data);
    });
  });
  ws.on('disconnect', () => {
    logger.info(`ID: ${ws.id} saiu`);});
  //send immediatly a feedback to the incoming connection    
  ws.send('Hi there, I am a WebSocket server');
};

module.exports = disparoSocket;