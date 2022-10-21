const { default: axios } = require('axios');
const FormData = require('form-data');

exports.onWhatsapp = async (req, res) => {
  // eslint-disable-next-line no-unsafe-optional-chaining
  const data = await WhatsAppInstances[req.query.key]?.verifyId(
    WhatsAppInstances[req.query.key]?.getWhatsAppId(req.query.id)
  );
  // let reqs = new FormData();
  // reqs.append('content', `Número Higienizado: ${req.query.id}\nhorário: ${new Date()}\nResutado: ${data}`);
  // reqs.append('message_type', 'outgoing');
  // reqs.append('content_type', 'text');
  // reqs.append('private', 'true');
  // let configPost = Object.assign(
  //   {},
  //   {
  //     baseURL: process.env.CHATWOOT_URL,
  //     headers: {
  //       'Content-Type': 'application/json;charset=utf-8',
  //       api_access_token: process.env.CHATWOOT_TOKEN,
  //     }
  //   }
  // );
  // configPost.headers = { ...configPost.headers, ...reqs.getHeaders() };
  // axios.post('api/v1/accounts/1/conversations/11/messages',
  //   reqs,
  //   configPost
  // );
  return res.status(201).json({ error: false, data: data });
};

exports.downProfile = async (req, res) => {
  const data = await WhatsAppInstances[req.query.key]?.DownloadProfile(
    req.query.id
  );
  return res.status(201).json({ error: false, data: data });
};

exports.getStatus = async (req, res) => {
  const data = await WhatsAppInstances[req.query.key]?.getUserStatus(
    req.query.id
  );
  return res.status(201).json({ error: false, data: data });
};

exports.blockUser = async (req, res) => {
  await WhatsAppInstances[req.query.key]?.blockUnblock(
    req.query.id,
    req.query.block_status
  );
  if (req.query.block_status == 'block') {
    return res.status(201).json({ error: false, message: 'Contact Blocked' });
  } else
    return res.status(201).json({ error: false, message: 'Contact Unblocked' });
};
