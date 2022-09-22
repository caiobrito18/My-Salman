const db = require('../helper/mongoConn');

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
  const data = numeros.map(async (numero) => {
    var rand1 = Math.floor(Math.random() * despedidas.length);
    var rand2 = Math.floor(Math.random() * saudacoes.length);
    var rand3 = Math.floor(Math.random() * sessoes.length);
    var time = Math.floor(Math.random() * (maxWait - minWait)) + minWait;
    let randGoodbye = despedidas[rand1];
    let randGreet = saudacoes[rand2];
    let mensagem = [randGreet, corpo, randGoodbye].join('\n');
    let chave = sessoes[rand3];

    await new Promise((r) => {
      setTimeout(r, time * 1000);
    });
    await WhatsAppInstances[chave].sendTextMessage(numero, mensagem);
    return numero;
  });
  const update = numeros.map(async (numero) => {
    return dbconection.collection('base_vivo').updateOne(
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
        if (err) throw err;
        console.log('1 document updated');
      }
    );
  });
  console.log(update);
  return res.status(201).json({ error: false, data: data });
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
