const db = require('../helper/mongoConn');
const sleep = require('../helper/sleep');

exports.status = async(req,res)=>{
  const sessions = req.body.sessions
  let sessionsInfo = new Array
  for(let i = 0; i < sessions.length; i++){
    const instance = WhatsAppInstances[sessions[i]]
      let data = ''
      try {
          data = await instance.getInstanceDetail(sessions[i])
          sessionsInfo.push(data)
      } catch (error) {
        data = {}
        throw new Error(error)
      }
  }
    return res.json({
        error: false,
        message: 'Instance fetched successfully',
        // instance_data: data,
        instance_data: sessionsInfo,
    })
}

exports.disparo = async(req,res) =>{
  const dados = req.body.MessageData;
  const numeros =  req.body.Numbers;
  const minWait =  req.body.minWait;
  const maxWait =  req.body.maxWait;
  const corpo = dados.MessageBody;
  const saudacoes = dados.greets;
  const despedidas = dados.goodbyes;
  const sessoes = dados.sessions;

  console.log(req.body);

  const data = numeros.map(async(numero)=>{
    var rand1 = Math.floor(Math.random() * (despedidas.length));
    var rand2 = Math.floor(Math.random() * (saudacoes.length));
    var rand3 = Math.floor(Math.random() * (sessoes.length));
    var time = Math.floor(Math.random() * ( maxWait - minWait)) + minWait;

    let randGoodbye = (despedidas[rand1])
    let randGreet = saudacoes[rand2]
    let mensagem = [randGreet,corpo,randGoodbye].join('\n')
    let chave = sessoes[rand3];
    console.log({
      numero,
      randGoodbye,
      randGreet,
      mensagem,
      chave
    })
    await new Promise((r => {setTimeout(r, time*1000)}))
    await WhatsAppInstances[chave].sendTextMessage(
      numero,
      mensagem
      )

  })
  // numberArray.map((messageBody,greets,goodbyes,instanceList, numberArray)=>{
    //   let randGoodbye = (goodbyeArray[rand1])
    //   let randGreet = greetArray[rand2]
    //   let mensagem = [randGreet,messageBody,randGoodbye].join('\n')
    //   let chave = sessoes[rand3].sessao;
    // })
    
    return res.status(201).json({ error: false, data: data })
}

exports.numeros = async(req,res) =>{
  const dbconnect = db.getDb()
  return dbconnect.collection("base_vivo")
  .aggregate(
    [
        {
            "$match": {
                "WHATSAPP": "S",
                "CID_ABREV": {
                    "$in": [
                        "GNA",
                        "MNS"
                    ]
                }
            }
        },
        {
            "$group": {
                "_id": {
                    "TELEFONE": "$TELEFONE",
                    "CID_ABREV": "$CID_ABREV"
                }
            }
        },
        {
            "$project": {
                "CID_ABREV": "$_id.CID_ABREV",
                "TELEFONE": "$_id.TELEFONE",
                "_id": 0
            }
        },
        {
            "$limit": 100
        }
    ])
    .toArray(function (err, result) {
      if (err) {
        res.status(400).send(`Error fetching listings! ${err}`);
      } else {
        res.json(result);
      }
    });
}