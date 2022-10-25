/* eslint-disable no-unsafe-optional-chaining */
const QRCode = require('qrcode');
const pino = require('pino');
const toStream  = require('buffer-to-stream');
const mime = require('mime-types');
const {
  default: makeWASocket,
  useSingleFileAuthState,
  DisconnectReason,
  delay,
  useMultiFileAuthState,
} = require('@adiwajshing/baileys');
const FormData = require('form-data');
const { unlinkSync, readFileSync, stat, writeFile, readFile, writeFileSync } = require('fs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const processButton = require('../helper/processbtn');
const generateVC = require('../helper/genVc');
// const Chat = require("../models/chat.model")
const axios = require('axios');
const config = require('../../config/config');
const downloadMessage = require('../helper/downloadMsg');

class WhatsAppInstance {
  socketConfig = {
    printQRInTerminal: false,
    browser: ['FastBot N8N MD', '', '3.0'],
    logger: pino({
      level: 'debug',
    }),
  };
  key = '';
  authState;
  allowWebhook = true;
  instance = {
    key: this.key,
    chats: [],
    qr: '',
    messages: [],
  };

  chatwoot_inbox_id;
  chatwoot_account_id;
  mobile_number = '';
  chatwoot_sender = {
    pushname: '',
    id: ''
  };
  chatwoot_api = axios.create({
    baseURL: '',
    headers: {},
  });

  axiosInstance = axios.create({
    baseURL: config.webhookUrl,
  });

  constructor(key, allowWebhook = true, webhook = null, chatwoot_config) {
    this.key = key ? key : uuidv4();

    if (chatwoot_config) {
      stat(path.join(__dirname,`../chatwootdata/${this.key}.json`), (err, stats)=>{
        if(err){ 
          if(err.code == 'ENOENT'){
            let chatwootData = JSON.stringify(chatwoot_config);
            writeFile(path.join(__dirname,`../chatwootdata/${this.key}.json`), Buffer.from(chatwootData), (err) => {
              pino().error(err);
            });
          }
        }
      });
    };
    this.allowWebhook = allowWebhook;
    if (this.allowWebhook && webhook !== null) {
      this.axiosInstance = axios.create({
        baseURL: webhook,
      });
    }
    readFile(path.join(__dirname,`../chatwootdata/${this.key}.json`), (err, data) => {
      if (err) throw err;
      let chatwootData = JSON.parse(data.toString());
      this.setChatwoot(chatwootData);
    });
    console.log(this.chatwoot);
    this.authState = useSingleFileAuthState(
      path.join(__dirname, `../sessiondata/${this.key}.json`)
    );
  }

  async SendWebhook(data) {
    if (!this.allowWebhook) return;
    this.axiosInstance.post('', data).catch((error) => {
      return error;
    });
  }

  async init() {
    this.socketConfig.auth = this.authState.state;
    this.instance.sock = makeWASocket(this.socketConfig);
    this.mobile_number = this.instance.sock?.user?.id.split(':')[0];
    this.chatwoot_sender = {
      pushname: this.instance.sock?.user?.name,
      id: this.instance.sock?.user?.id.split(':')[0]
    };

    this.setHandler();
    return this;
  }
  
  setChatwoot(data){
    this.chatwoot = data;
    this.account_id = this.chatwoot.account_id;
    this.inbox_id = this.chatwoot.inbox_id;
    this.chatwoot_api = axios.create({
      baseURL: this.chatwoot.baseURL,
      headers: { 'Content-Type': 'application/json;charset=utf-8', api_access_token: this.chatwoot.chatwoot_token },
    });
  }
  setHandler() {
    const sock = this.instance.sock;
    // on credentials update save state
    sock?.ev.on('creds.update', this.authState.saveState);

    // on socket closed, opened, connecting
    sock?.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (connection === 'connecting') return;
      
      if (connection === 'close') {
        // reconnect if not logged out
        if (
          lastDisconnect?.error?.output?.statusCode !==
          DisconnectReason.loggedOut
        ) {
          await this.init();
        } else {
          unlinkSync(path.join(__dirname, `../sessiondata/${this.key}.json`));
          this.instance.online = false;
        }
      } else if (connection === 'open') {
        this.instance.online = true;
      }

      if (qr) {
        QRCode.toDataURL(qr).then((url) => {
          this.instance.qr = url;
          this.SendWebhook({
            type: 'update',
            message: 'Received QR Code',
            key: this.key,
            qrcode: url,
          });
        });
      }
    });

    // on receive all chats
    sock?.ev.on('chats.set', async ({ chats }) => {
      const recivedChats = chats.map((chat) => {
        return {
          ...chat,
          messages: [],
        };
      });
      this.instance.chats.push(...recivedChats);
      //    const db = await Chat({key: this.key, chat: this.instance.chats})
      //    await db.save()
      //    console.log(db)
    });

    // on recive new chat
    sock?.ev.on('chats.upsert', (newChat) => {
      // console.log("Received new chat")
      const chats = newChat.map((chat) => {
        return {
          ...chat,
          messages: [],
        };
      });
      this.instance.chats.push(...chats);
    });

    // on chat change
    sock?.ev.on('chats.update', (changedChat) => {
      changedChat.map((chat) => {
        const index = this.instance.chats.findIndex((pc) => pc.id === chat.id);
        const PrevChat = this.instance.chats[index];
        this.instance.chats[index] = {
          ...PrevChat,
          ...chat,
        };
      });
    });

    // on chat delete
    sock?.ev.on('chats.delete', (deletedChats) => {
      deletedChats.map((chat) => {
        const index = this.instance.chats.findIndex((c) => c.id === chat);
        this.instance.chats.splice(index, 1);
      });
    });

    // on new mssage
    sock?.ev.on('messages.upsert', async(m) => {
      if (m.type == 'prepend') this.instance.messages.unshift(...m.messages);
      if (m.type != 'notify') return;

      this.instance.messages.unshift(...m.messages);
      
      await m.messages.map(async (msg) => {
        if (!msg.message) return;
        if (msg.key.fromMe){ 
          this.chatwootSendMessage(this, msg);
          return; };

        const messageType = Object.keys(msg.message)[0];
        if (
          ['protocolMessage', 'senderKeyDistributionMessage'].includes(
            messageType
          )
        )
          return;

        const webhookData = {
          key: this.key,
          ...msg,
        };
          

        if (messageType === 'conversation') {
          this.chatwootSendMessage(this, msg);
          webhookData[(this.key, 'text')] = m;
        }
        if (config.webhookBase64) {
          switch (messageType) {
          case 'imageMessage':
            webhookData['msgContent'] = await downloadMessage(
              msg.message.imageMessage,
              'image'
            );
            break;
          case 'videoMessage':
            webhookData['msgContent'] = await downloadMessage(
              msg.message.videoMessage,
              'video'
            );
            break;
          case 'audioMessage':
            webhookData['msgContent'] = await downloadMessage(
              msg.message.audioMessage,
              'audio'
            );
            break;
          default:
            webhookData['msgContent'] = '';
            break;
          }
        }
        
        
      });
    });
  }

  async getInstanceDetail(key) {
    return {
      instance_key: key,
      phone_connected: this.instance?.online,
      user: this.instance.sock?.user,
    };
  }

  getWhatsAppId(id) {
    if (id.includes('@g.us') || id.includes('@s.whatsapp.net')) return id;
    return id.includes('-') ? `${id}@g.us` : `${id}@s.whatsapp.net`;
  }

  async verifyId(id) {
    if (id.includes('@g.us')) return true;
    const [result] = await this.instance.sock?.onWhatsApp(id);
    if (result?.exists) return true;
    return false;
  }

  async sendTextMessage(to, message) {
    await this.verifyId(this.getWhatsAppId(to));
    await this.instance.sock?.presenceSubscribe(to);
    await delay(500);
    await this.instance.sock?.sendPresenceUpdate('composing', to);
    await delay((Math.floor(Math.random() * 4)+1)*1000);
    await this.instance.sock?.sendPresenceUpdate('paused', to);
    const data = await this.instance.sock?.sendMessage(this.getWhatsAppId(to), {
      text: message,
    });
    return data;
  }

  async sendMediaFile(to, path, file, type, caption = '', mimetype) {
    await this.verifyId(this.getWhatsAppId(to));
    await this.instance.sock?.presenceSubscribe(to);
    await delay(500);
    await this.instance.sock?.sendPresenceUpdate('composing', to);
    await delay(1000);
    await this.instance.sock?.sendPresenceUpdate('paused', to);
    const data = await this.instance.sock?.sendMessage(this.getWhatsAppId(to), {
      [type]: { url: path + file },
      mimetype: mimetype,
      caption: caption,
      ptt: type === 'audio' ? true : false,
    });
    return data;
  }

  async sendMediaPix(to, base64code) {
    await this.verifyId(this.getWhatsAppId(to));
    await this.instance.sock?.presenceSubscribe(to);
    await delay(500);
    await this.instance.sock?.sendPresenceUpdate('composing', to);
    await delay(1000);
    await this.instance.sock?.sendPresenceUpdate('paused', to);
    const data = await this.instance.sock?.sendMessage(this.getWhatsAppId(to), {
      image: Buffer.from(base64code, 'base64'),
      mimetype: 'image/png',
    });
    return data;
  }

  async sendDocFile(to, path, file, type, caption = '', mimetype, filename) {
    await this.verifyId(this.getWhatsAppId(to));
    await this.instance.sock?.presenceSubscribe(to);
    await delay(500);
    await this.instance.sock?.sendPresenceUpdate('composing', to);
    await delay(1000);
    await this.instance.sock?.sendPresenceUpdate('paused', to);
    const data = await this.instance.sock?.sendMessage(this.getWhatsAppId(to), {
      mimetype: mimetype,
      [type]: { url: path + file },
      caption: caption,
      fileName: filename ? filename : file,
    });
    return data;
  }

  async sendLinkMessage(
    to,
    textbefore = '',
    url,
    textafter = '',
    title,
    description,
    path,
    file
  ) {
    await this.verifyId(this.getWhatsAppId(to));
    await this.instance.sock?.presenceSubscribe(to);
    await delay(500);
    await this.instance.sock?.sendPresenceUpdate('composing', to);
    await delay(1000);
    await this.instance.sock?.sendPresenceUpdate('paused', to);
    const result = await this.instance.sock?.sendMessage(
      this.getWhatsAppId(to),
      {
        text: textbefore + ' ' + url + ' ' + textafter,
        matchedText: url,
        canonicalUrl: url,
        title: title,
        description: description,
        jpegThumbnail: readFileSync(path + file),
      }
    );
    return result;
  }

  async DownloadProfile(of) {
    await this.verifyId(this.getWhatsAppId(of));
    const ppUrl = await this.instance.sock?.profilePictureUrl(
      this.getWhatsAppId(of),
      'image'
    );
    return ppUrl;
  }

  async getUserStatus(of) {
    await this.verifyId(this.getWhatsAppId(of));
    const status = await this.instance.sock?.fetchStatus(
      this.getWhatsAppId(of)
    );
    return status;
  }

  async blockUnblock(to, data) {
    await this.verifyId(this.getWhatsAppId(to));
    const status = await this.instance.sock?.updateBlockStatus(
      this.getWhatsAppId(to),
      data
    );
    return status;
  }

  async sendButtonMessage(to, data) {
    await this.verifyId(this.getWhatsAppId(to));
    await this.instance.sock?.presenceSubscribe(to);
    await delay(500);
    await this.instance.sock?.sendPresenceUpdate('composing', to);
    await delay(1000);
    await this.instance.sock?.sendPresenceUpdate('paused', to);
    const result = await this.instance.sock?.sendMessage(
      this.getWhatsAppId(to),
      {
        buttons: data.buttons ?? '',
        text: data.text ?? '',
        footer: data.footer ?? '',
        headerType: data.headerType ?? 1,
      }
    );
    return result;
  }

  async sendTemplateButtonMessage(to, data) {
    await this.verifyId(this.getWhatsAppId(to));
    await this.instance.sock?.presenceSubscribe(to);
    await delay(500);
    await this.instance.sock?.sendPresenceUpdate('composing', to);
    await delay(1000);
    await this.instance.sock?.sendPresenceUpdate('paused', to);
    const result = await this.instance.sock?.sendMessage(
      this.getWhatsAppId(to),
      {
        templateButtons: processButton(data.buttons),
        text: data.text ?? '',
        footer: data.footerText ?? '',
      }
    );
    return result;
  }

  async sendContactMessage(to, data) {
    await this.verifyId(this.getWhatsAppId(to));
    await this.instance.sock?.presenceSubscribe(to);
    await delay(500);
    await this.instance.sock?.sendPresenceUpdate('composing', to);
    await delay(1000);
    await this.instance.sock?.sendPresenceUpdate('paused', to);
    const vcard = generateVC(data);
    const result = await this.instance.sock?.sendMessage(
      await this.getWhatsAppId(to),
      {
        contacts: {
          displayName: data.fullName,
          contacts: [{ displayName: data.fullName, vcard }],
        },
      }
    );
    return result;
  }

  async sendListMessage(to, data) {
    await this.verifyId(this.getWhatsAppId(to));
    await this.instance.sock?.presenceSubscribe(to);
    await delay(500);
    await this.instance.sock?.sendPresenceUpdate('composing', to);
    await delay(1000);
    await this.instance.sock?.sendPresenceUpdate('paused', to);
    const result = await this.instance.sock?.sendMessage(
      this.getWhatsAppId(to),
      {
        text: data.text,
        sections: data.sections,
        buttonText: data.buttonText,
        footer: data.description,
        title: data.title,
      }
    );
    return result;
  }

  async sendMediaButtonMessage(to, data) {
    await this.verifyId(this.getWhatsAppId(to));
    await this.instance.sock?.presenceSubscribe(to);
    await delay(500);
    await this.instance.sock?.sendPresenceUpdate('composing', to);
    await delay(1000);
    await this.instance.sock?.sendPresenceUpdate('paused', to);
    const result = await this.instance.sock?.sendMessage(
      this.getWhatsAppId(to),
      {
        [data.mediaType]: {
          url: data.path + data.image,
        },
        footer: data.footerText ?? '',
        caption: data.text,
        templateButtons: processButton(data.buttons),
        mimetype: data.mimeType,
      }
    );
    return result;
  }

  async sendLocationMessage(to, data) {
    await this.verifyId(this.getWhatsAppId(to));
    await this.instance.sock?.presenceSubscribe(to);
    await delay(500);
    await this.instance.sock?.sendPresenceUpdate('composing', to);
    await delay(1000);
    await this.instance.sock?.sendPresenceUpdate('paused', to);
    const result = await this.instance.sock?.sendMessage(
      this.getWhatsAppId(to),
      {
        location: {
          degreesLatitude: data.latitude,
          degreesLongitude: data.longitude,
        },
      }
    );
    return result;
  }

  async sendReactionMessage(to, data) {
    await this.verifyId(this.getWhatsAppId(to));
    const result = await this.instance.sock?.sendMessage(
      this.getWhatsAppId(to),
      {
        react: {
          text: data.emoticon,
          key: {
            remoteJid: to,
            id: data.id,
            fromMe: false,
            participant: data.participant,
          },
        },
      }
    );
    return result;
  }

  // Group Methods
  parseParticipants(users) {
    return users.map((users) => this.getWhatsAppId(users));
  }

  async createNewGroup(name, users) {
    const group = await this.instance.sock?.groupCreate(
      name,
      users.map(this.getWhatsAppId)
    );
    return group;
  }

  async addNewParticipant(id, users) {
    try {
      const res = await this.instance.sock?.groupAdd(
        this.getWhatsAppId(id),
        this.parseParticipants(users)
      );
      return res;
    } catch {
      return {
        error: true,
        message:
          'Unable to add participant, you must be an admin in this group',
      };
    }
  }

  async makeAdmin(id, users) {
    try {
      const res = await this.instance.sock?.groupMakeAdmin(
        this.getWhatsAppId(id),
        this.parseParticipants(users)
      );
      return res;
    } catch {
      return {
        error: true,
        message:
          'unable to promote some participants, check if you are admin in group or participants exists',
      };
    }
  }

  async demoteAdmin(id, users) {
    try {
      const res = await this.instance.sock?.groupDemoteAdmin(
        this.getWhatsAppId(id),
        this.parseParticipants(users)
      );
      return res;
    } catch {
      return {
        error: true,
        message:
          'unable to demote some participants, check if you are admin in group or participants exists',
      };
    }
  }

  async getAllGroups() {
    // let AllChat = await Chat.findOne({key: key}).exec();
    return this.instance.chats.filter((c) => c.id.includes('@g.us'));
  }

  async leaveGroup(id) {
    const group = this.instance.chats.find((c) => c.id === id);
    if (!group) throw new Error('no group exists');
    return await this.instance.sock?.groupLeave(id);
  }

  async getInviteCodeGroup(id) {
    const group = this.instance.chats.find((c) => c.id === id);
    if (!group)
      throw new Error('unable to get invite code, check if the group exists');
    return await this.instance.sock?.groupInviteCode(id);
  }

  //Chatwoot Integration

  async chatwootSendMessage(client, message) {
    // console.log(client);
    // if (message.isGroupMsg || message.chatId.indexOf('@broadcast') > 0) return;
    let contact = await this.chatwootCreateContact(message);
    let conversation = await this.chatwootCreateConversation(contact, message.key.remoteJid.split('@')[0]);
    const imageMessage = message.imageMessage;
    try {
      if (
        imageMessage.type == 'image' ||
        imageMessage.type == 'video' ||
        imageMessage.type == 'in' ||
        imageMessage.type == 'document' ||
        imageMessage.type == 'ptt' ||
        imageMessage.type == 'audio' ||
        imageMessage.type == 'sticker'
      ) {
        if (imageMessage.mimetype == 'image/webp') imageMessage.mimetype = 'image/jpeg';
        const extension = mime.extension(imageMessage.mimetype);
        let filename = `${message.timestamp}.${extension}`;
        let b64;

        if (message.qrCode) b64 = message.qrCode;
        else {
          let buffer = await client.decryptFile(message);
          b64 = await buffer.toString('base64');
        }

        let mediaData = Buffer.from(b64, 'base64');

        let data = new FormData();
        if (message.caption) {
          data.append('content', message.caption);
        }
        data.append('attachments[]', toStream(mediaData), {
          filename: filename,
          contentType: message.mimetype,
        });
        !message.key.fromMe ? data.append('message_type', 'incoming') : data.append('message_type', 'outgoing');
        data.append('private', 'false');

        let configPost = Object.assign(
          {},
          {
            baseURL: this.chatwoot.baseURL,
            headers: {
              'Content-Type': 'application/json;charset=utf-8',
              api_access_token: this.chatwoot.chatwoot_token,
            },
          }
        );
        configPost.headers = { ...configPost.headers, ...data.getHeaders() };

        var result = await axios.post(
          `api/v1/accounts/${this.account_id}/conversations/${conversation.id}/messages`,
          data,
          configPost
        );

        return result;
      } else {
        let body = {
          content: message.message.conversation,
          message_type: 'incoming',
        };
        const { data } = await this.chatwoot_api.post(
          `api/v1/accounts/${this.account_id}/conversations/${conversation.id}/messages`,
          body
        );
        return data;
      }
    } catch (e) {
      return null;
    }
  }

  async findContact(query) {
    try {
      const { data } = await this.chatwoot_api.get(`api/v1/accounts/${this.account_id}/contacts/search/?q=${query}`);
      return data;
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  async chatwootCreateContact(message) {
    let body = {
      inbox_id: this.inbox_id,
      name: message.pushName,
      phone_number: `+${this.mobile_number}`,
    };
    var contact = await this.findContact(body.phone_number.replace('+', ''));
    if (contact && contact.meta.count > 0) return contact.payload[0];

    try {
      const data = await this.chatwoot_api.post(`api/v1/accounts/${this.account_id}/contacts`, body);
      return data.data.payload.contact;
    } catch (e) {
      pino().error(e);
      return null;
    }
  }

  async findConversation(contact) {
    try {
      const { data } = await this.chatwoot_api.get(
        `api/v1/accounts/${this.account_id}/conversations?inbox_id=${this.inbox_id}&status=all`
      );
      return data.data.payload.find((e) => e.meta.sender.id == contact.id && e.status != 'resolved');
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  async chatwootCreateConversation(contact, source_id) {
    var conversation = await this.findConversation(contact);
    if (conversation) return conversation;

    let body = {
      source_id: source_id,
      inbox_id: this.inbox_id,
      contact_id: contact.id,
      status: 'open',
    };

    try {
      const { data } = await this.chatwoot_api.post(`api/v1/accounts/${this.account_id}/conversations`, body);
      return data;
    } catch (e) {
      console.log(e);
      return null;
    }
  }
}


exports.WhatsAppInstance = WhatsAppInstance;
