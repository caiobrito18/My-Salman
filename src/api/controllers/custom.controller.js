const db = require('../helper/mongoConn');
const { WhatsAppInstance } = require('../class/instance');
const crypto = require('crypto');
const mime = require('mime');
const logger = require('pino')();
const sleep = require('../helper/sleep');
const download = require('download');
const path = require('path');
const { readFileSync } = require('fs');
const { readFile } = require('fs').promises;
exports.status = async (req, res) => {
  const sessions = req.body.sessions;
  let sessionsInfo = new Array();
  for (let i = 0; i < sessions.length; i++) {
    const instance = WhatsAppInstances[sessions[i]];
    let data = '';
    try {
      data = await instance.getInstanceDetail(sessions[i]);
      sessionsInfo.push(data);
    } catch (error) {
      data = {};
      throw new Error(error);
    }
  }
  return res.json({
    error: false,
    message: 'Instance fetched successfully',
    // instance_data: data,
    instance_data: sessionsInfo,
  });
};

exports.disparo = async (req, res) => {
  const dados = req.body.MessageData;
  const numeros = req.body.Numbers;
  const minWait = req.body.minWait;
  const maxWait = req.body.maxWait;
  const corpo = dados.MessageBody;
  const saudacoes = dados.greets;
  const despedidas = dados.goodbyes;
  const sessoes = dados.sessions;
  const dbconection = db.getDb();
  const data = [];
  for (const numero of numeros){
    var rand1 = Math.floor(Math.random() * despedidas.length);
    var rand2 = Math.floor(Math.random() * saudacoes.length);
    var rand3 = Math.floor(Math.random() * sessoes.length);
    var time = () => Math.floor(Math.random() * (maxWait - minWait + 1))+minWait;
    let randGoodbye = despedidas[rand1];
    let randGreet = saudacoes[rand2];
    let mensagem = [randGreet, corpo, randGoodbye].join('\n');
    let chave = sessoes[rand3];
    dbconection.collection('disparo_log').updateOne(
      {
        TELEFONE: { $in: [numero] },
      },
      {
        $inc: { ENVIADO: 1},
        $set: { ULTIMO_DISPARO: new Date().toLocaleString('pt-BR'), 
          SESSAO:chave}
      },
      {
        upsert: true,
      },
      function (err) {
        if (err) logger.error(err);
        console.log('1 document updated');
      }
    );
    data.push({rand1,
      rand2,
      rand3,
      time,
      randGoodbye,
      randGreet,
      mensagem,
      chave});
    await sleep(time()*1000);
    // await WhatsAppInstances[chave].sendTextMessage(numero, mensagem);
  };
  return res.status(201).json({ error: false, data });
};

exports.numeros = async (req, res) => {
  const dbconnect = db.getDb();  
  const filter = req.body?.filter;
  const limit = req.body?.limit;
  console.log(req.body);

  let query = {
    WHATSAPP: {$regex: /^S/},
    BLACK_LIST:null,
    // ENVIADO: { $not: /[1-9]/ }
  };
  
  if(filter?.cid) query['CIDADE'] = {$in: filter?.cid};
  if(filter?.uf) query['UF'] = {$in: filter?.uf};
  if(filter?.cep) query['CEP'] = {$regex: filter.cep};
  if(filter?.bairro) query['BAIRRO'] = {$regex: filter?.bairro, $options: 'i' };
  if(filter?.endereco) query['ENDERECO'] = {$regex: filter.endereco, $options: 'i'};
  if(filter?.complemento) query['COMPLEMENTO'] = {$regex: filter.complemento, $options: 'i'};

  console.log(query);
  return dbconnect
    .collection('base_vivo_total')
    .aggregate([
      {
        $match: query,
      },
      {
        $limit: limit || 100,
      },
      {
        $group: {
          _id: {
            id: '$id',
            TELEFONE: '$TELEFONE',
            CID: '$CIDADE',
            BAIRRO: '$BAIRRO',
            UF: '$UF',
          },
        },
      },
      {
        $project: {
          UF: '$_id.UF',
          CID_ABREV: '$_id.CID',
          TELEFONE: '$_id.TELEFONE',
          BAIRRO: '$_id.BAIRRO',
          _id: 0,
        },
      },
    ])
    .toArray(function (err, result) {
      if (err) {
        res.status(500).send(`Error fetching listings! ${err}`);
      } else {
        res.json(result);
      }
    });
};

exports.states = async (req, res) => {
  const dbconnect = db.getDb();  
  res.status(202);
  return await dbconnect
    .collection('bv_view_uf')
    .find({ UF: { $ne: null } })
    .toArray(function (err, result) {
      if (err) {
        res.status(500).send(`Error fetching listings! ${err}`);
      } else {
        res.json(result);
      }
    });
};
exports.cidades = async (req, res) => {
  const dbconnect = db.getDb();  
  const data = req.body?.uf;
  const limit = req.body?.limit;

  return dbconnect
    .collection('base_vivo')
    .aggregate([
      {
        $match: {
          UF: {'$in':data},
        },
      },
      {
        $group: {
          _id: {
            CID: '$CIDADE',
          },
        },
      },
      {
        $project: {
          UF: '$_id.UF',
          CIDADE: '$_id.CID',
          _id: 0,
        },
      },
      {
        $limit: limit || 100,
      },
    ])
    .toArray(function (err, result) {
      if (err) {
        res.status(500).send(`Error fetching listings! ${err}`);
      } else {
        res.json(result);
      }
    });
};

exports.campaings = {
  create:(
    async(req,res)=>{
      const dbconnect = db.getDb();
      const data = req.body;
      // {
      //   status,
      //   numeros,
      //   nomes,
      //   primeiraConexão,
      //   ultimaConexão,
      //   campanha
      // }
      const hash = crypto.randomBytes(8).toString('hex').replace(/.{4}(?!$)/g, '$&-');
      console.log(hash);
      await dbconnect.collection('l_sessoes').insertOne(
        {
          STATUS:data?.status,
          SESSOES:data?.sessions,
          CreatedAt: new Date(),
          CAMPANHA: data?.campaign.length !== 0 ? data?.campaign : hash,
        }).catch(function (err) {
        if(err) res.status(500).send(`error ${err}`);
      });
      return res.status(201).send('sucesso na criação da campanha');
    }),
  update:(
    async(req,res)=>{
      const dbconnect = db.getDb();
      const data = req.body;
      const updates = {
        UpdatedAt:new Date(),
      };
      if(data?.status) updates['STATUS'] = data.status;
      if(data?.sessions) updates['SESSOES'] = data.sessions;
      
      // if(data?.status) updates['NUMEROS'] = data.numbers;
      // if(data?.status) updates['NOMES'] = data.names;


      console.log(updates);
      dbconnect.collection('l_sessoes').updateOne(
        {
          CAMPANHA:data?.campaign
        },
        {'$set':{...updates}},
        {
          upsert:true
        });
      return res.status(201).send('sucesso na criação da campanha');
    }),
  get:(
    async(req,res)=>{
      const dbconnect = db.getDb();
      return await dbconnect
        .collection('l_sessoes')
        .find()
        .toArray(
          function (err, result) {
            if (err) {
              res.status(500).send(`Error getting Campaigns! ${err}`);
            } else {
              res.json(result);
            }
          });
      
    }
  )
};

exports.chatwoot = async(req,res)=>{
  const { session } = req.params;
  const client = WhatsAppInstances[session];
  // eslint-disable-next-line no-undefined
  if (client === undefined) return;
  try {
    if (await client.isConnected()) {
      const event = req.body.event;

      if (event == 'conversation_status_changed' || event == 'conversation_resolved' || req.body.private) {
        return res.status(200).json({ status: 'success', message: 'Success on receive chatwoot' });
      }

      const {
        message_type,
        phone = req.body.conversation.meta.sender.phone_number.replace('+', ''),
        message = req.body.conversation.messages[0],
      } = req.body;
      if (event != 'message_created' && message_type != 'outgoing') return res.status(200);
      if (message_type == 'outgoing') {
        if (message.attachments) {
          let base_url = `${client.chatwoot.baseURL}/${message.attachments[0].data_url.substring(
            message.attachments[0].data_url.indexOf('/rails/') + 1
          )}`;
          const FileName = message.attachments[0].data_url.split('/').slice(-1);
          await download(base_url, path.join(__dirname, '../files'));
          const filePath = `${__dirname}/../files/${FileName}`;
          const file = await readFile(filePath);
          const fmmt = mime.getType(filePath);
          const ftype = fmmt.split('/')[0];
          sleep(5000);
          if(ftype == 'image' ||
          ftype == 'video' ||
          ftype == 'audio'){
            logger.info(ftype); 
            await client.sendMediaFile(phone, filePath, file, ftype,'', fmmt);
          } else{ 
            logger.info(ftype + '135468'); 
            await client.sendDocFile(phone, filePath, file, ftype,'', fmmt, FileName);
          };
        } else if( message.content != client.instance.messages[0]?.message?.conversation ) {
          await client.sendTextMessage(phone, message.content);
        }
      }
      return res.status(200).json({ status: 'success', message: 'Success on  receive chatwoot' });
    }
  } catch (e) {
    logger.error(e);
    return res.status(400).json({ status: 'error', message: 'Error on  receive chatwoot' });
  }
};

exports.usersSU = async(req, res)=>{
  const dbconnect = db.getDb();
  const user = req.body;
  if(!user.username || user.username === '' || !user.password || user.password === '' ) return res.send('ERRO, FALTANDO USUÁRIO OU SENHA').status(400);
  await dbconnect.collection('usuarios_disparo').find({USERNAME: user.username }).toArray((err, res)=>{
    if(err) res.send('erro :', err).status(500);
    if(res !== {}) res.send('Usuário já existente').status(409);
    return;
  });
  await dbconnect.collection('usuarios_disparo').insertOne(
    {
      username: user.username,
      password: user.password
    });
};