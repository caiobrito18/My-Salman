const express = require('express');
const path = require('path');
const cors = require('cors');
const exceptionHandler = require('express-exception-handler');
exceptionHandler.handle();
const app = express();
const db = require('../api/helper/mongoConn');
const error = require('../api/middlewares/error');

db.connectToServer();
app.use(
  cors({
    origin: '*',
  })
);
app.use(express.json());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../api/views'));

// app.use(express.static(path.join(__dirname, 'public')));
global.WhatsAppInstances = {};

const routes = require('../api/routes/');
app.use('/', routes);
app.use(error.handler);

module.exports = app;
