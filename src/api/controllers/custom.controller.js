const db = require('../helper/mongoConn');
const { WhatsAppInstance } = require('../class/instance');
const crypto = require('crypto');
const logger = require('pino')();
const wss = require('../../config/websocket');
const sleep = require('../helper/sleep');
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
    dbconection.collection('base_vivo').updateOne(
      {
        TELEFONE: { $in: [numero.slice(-7)] },
      },
      {
        $inc: { ENVIADO: 1 },
      },
      {
        upsert: true,
      },
      function (err) {
        if (err) logger.error(err);
        console.log('1 document updated');
      }
    );
    logger.info({rand1,
      rand2,
      rand3,
      time,
      randGoodbye,
      randGreet,
      mensagem,
      chave});
    data.push({rand1,
      rand2,
      rand3,
      time,
      randGoodbye,
      randGreet,
      mensagem,
      chave});
    await sleep(time()*1000);
    await WhatsAppInstances[chave].sendTextMessage(numero, mensagem);
  };
  return res.status(201).json({ error: false, data });
};

exports.numeros = async (req, res) => {
  const dbconnect = db.getDb();  
  const filter = req.body?.filter;
  const limit = req.body?.limit;
  console.log(req.body);

  let query = {
    // WHATSAPP: 'S',
    // BLACK_LIST:null,
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

exports.test = async(req,res)=>{
  const data = req.body;
  const instance = await WhatsAppInstance[req.query.key];
  console.log(instance);
  wss.emit('test');
  res.send('ok').status(200);
};