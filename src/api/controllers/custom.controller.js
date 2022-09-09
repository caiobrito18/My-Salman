const db = require('../helper/mongoConn')

exports.status = async(req,res)=>{
  console.log(req.body.sessions[0])
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

/* exports.disparo = async(req,res) =>{
  const messageBody = req.body.messageBody;
  const greets = req.body.greetArray;
  const goodbyes = req.body.goodbyeArray;
  const numberArray = req.body.numberArray;
  const instanceList = req.body.instancias;

  numberArray.map((messageBody,greets,goodbyes,instanceList, numberArray)=>{
    req.body
  })

} */
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
            "$limit": 1000
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