const { WhatsAppInstance } = require('../class/instance');
const fs = require('fs');
const logger = require('pino')();
const path = require('path');
const config = require('../../config/config');
const db = require('../helper/mongoConn');

exports.init = async (req, res) => {
  const { key, baseURL, token, inbox_id, account_id, chatwoot_token } = req.query;
  const chatwoot_config = { baseURL, token, inbox_id, account_id, chatwoot_token };
  const webhook = !req.query.webhook ? false : req.query.webhook;
  const webhookUrl = !req.query.webhookUrl ? null : req.query.webhookUrl;
  const instance = new WhatsAppInstance(key, webhook, webhookUrl);
  const data = await instance.init(chatwoot_config).catch(e => logger.error(e));
  WhatsAppInstances[data.key] = instance;
  res.json({
    error: false,
    message: 'Initializing successfully',
    key: data.key,
    browser: config.browser,
  });
};

exports.qr = async (req, res) => {
  try {
    const qrcode = await WhatsAppInstances[req.query.key]?.instance.qr;
    res.render('qrcode', {
      qrcode: qrcode,
    });
  } catch {
    res.json({
      qrcode: '',
    });
  }
};

exports.qrbase64 = async (req, res) => {
  try {
    const qrcode = await WhatsAppInstances[req.query.key]?.instance.qr;
    res.json({
      error: false,
      message: 'QR Base64 fetched successfully',
      qrcode: qrcode,
    });
  } catch {
    res.json({
      qrcode: '',
    });
  }
};

exports.info = async (req, res) => {
  const instance = WhatsAppInstances[req.query.key];
  console.log(instance.instance?.sock?.ws);
  let data;
  try {
    data = await instance.getInstanceDetail(req.query.key);
  } catch (error) {
    data = {};
  }
  return res.json({
    error: false,
    message: 'Instance fetched successfully',
    instance_data: data,
  });
};

exports.restore = async (req, res, next) => {
  try {
    let restoredSessions = [];
    const instances = fs.readdirSync(path.join(__dirname, '../sessiondata'));
    instances.map((file) => {
      if (file.includes('.json')) {
        restoredSessions.push(file.replace('.json', ''));
      }
    });
    restoredSessions.map(async(key) => {
      const instance = new WhatsAppInstance(key);
      logger.info(key);
      if(WhatsAppInstances[key] === undefined){
        await instance.init().catch(error => console.log(error));
        WhatsAppInstances[key] = instance;
        const details = instance.authState.state.creds;
        await db.getDb().collection('d_sessoes').updateOne(
          {
            KEY:key
          },
          {
            '$set':{INSTANCE: details.me,
              KEY:key,
              LAST_LOGIN:Date(details.lastAccountSyncTimestamp)}
          },
          {
            upsert:true
          }
        );
      }
    });
    return res.json({
      error: false,
      message: 'All instances restored',
      data: restoredSessions,
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res) => {
  let errormsg;
  try {
    await WhatsAppInstances[req.query.key].instance?.sock?.logout();
    delete WhatsAppInstances[req.query.key];
  } catch (error) {
    errormsg = error;
  }
  return res.json({
    error: false,
    message: 'logout successfull',
    errormsg: errormsg ? errormsg : null,
  });
};

exports.delete = async (req, res) => {
  let errormsg;
  try {
    await WhatsAppInstances[req.query.key].instance?.sock?.logout();
    delete WhatsAppInstances[req.query.key];
  } catch (error) {
    fs.rm(path.join(__dirname, '../sessiondata',`${req.query.key}.json`));
    delete WhatsAppInstances[req.query.key];
    logger.error(error);
    errormsg = error;
  }
  return res.json({
    error: false,
    message: 'Instance deleted successfully',
    data: errormsg ? errormsg : null,
  });
};

exports.list = async (req, res) => {
  if (req.query.active) {
    let instance = Object.keys(WhatsAppInstances).map(async (key) =>
      WhatsAppInstances[key].getInstanceDetail(key)
    );
    let data = await Promise.all(instance);
    return res.json({
      error: false,
      message: 'All active instance',
      data: data,
    });
  } else {
    let instance = [];
    const sessions = fs.readdirSync(path.join(__dirname, '../sessiondata'));
    sessions.map((file) => {
      if (file.includes('.json')) {
        instance.push(file.replace('.json', ''));
      }
    });
    return res.json({
      error: false,
      message: 'All instance listed',
      data: instance,
    });
  }
};
