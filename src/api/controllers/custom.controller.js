const { WhatsAppInstance } = require('../class/instance')

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