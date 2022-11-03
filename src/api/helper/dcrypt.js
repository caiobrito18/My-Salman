
const crypto =  require('crypto');
const hkdf = require('futoin-hkdf');
const atob = require('atob');
const { ResponseType, default: axios } = require('axios');

const makeOptions = (useragentOverride) => ({
  responseType: 'arraybuffer',
  headers: {
    'User-Agent': processUA(useragentOverride),
    DNT: '1',
    'Upgrade-Insecure-Requests': '1',
    origin: 'https://web.whatsapp.com/',
    referer: 'https://web.whatsapp.com/',
  },
});

const timeout = (ms) =>
  new Promise((res) => setTimeout(res, ms));
const mediaTypes = {
  IMAGE: 'Image',
  VIDEO: 'Video',
  AUDIO: 'Audio',
  PTT: 'Audio',
  DOCUMENT: 'Document',
  STICKER: 'Image',
};

const processUA = (userAgent) => {
  let ua =
    userAgent ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.63 Safari/537.36';
  if (!ua.includes('WhatsApp')) ua = 'WhatsApp/2.16.352 ' + ua;
  return ua;
};

const magix = (
  fileData,
  mediaKeyBase64,
  mediaType,
  expectedSize
) => {
  const encodedHex = fileData.toString('hex');
  const encodedBytes = hexToBytes(encodedHex);
  const mediaKeyBytes = base64ToBytes(mediaKeyBase64);
  const info = `WhatsApp ${mediaTypes[mediaType.toUpperCase()]} Keys`;
  const hash = 'sha256';
  const salt = new Uint8Array(32);
  const expandedSize = 112;
  const mediaKeyExpanded = hkdf(mediaKeyBytes, expandedSize, {
    salt,
    info,
    hash,
  });
  const iv = mediaKeyExpanded.slice(0, 16);
  const cipherKey = mediaKeyExpanded.slice(16, 48);
  const decipher = crypto.createDecipheriv('aes-256-cbc', cipherKey, iv);
  const decoded = decipher.update(encodedBytes);
  const mediaDataBuffer = expectedSize
    ? fixPadding(decoded, expectedSize)
    : decoded;
  return mediaDataBuffer;
};

const fixPadding = (data, expectedSize) => {
  let padding = (16 - (expectedSize % 16)) & 0xf;
  if (padding > 0) {
    if (expectedSize + padding == data.length) {
      //  console.log(`trimmed: ${padding} bytes`);
      data = data.slice(0, data.length - padding);
    } else if (data.length + padding == expectedSize) {
      // console.log(`adding: ${padding} bytes`);
      let arr = new Uint16Array(padding).map((b) => padding);
      data = Buffer.concat([data, Buffer.from(arr)]);
    }
  }
  //@ts-ignore
  return Buffer.from(data, 'utf-8');
};

const hexToBytes = (hexStr) => {
  const intArray = [];
  for (let i = 0; i < hexStr.length; i += 2) {
    intArray.push(parseInt(hexStr.substr(i, 2), 16));
  }
  return new Uint8Array(intArray);
};

const base64ToBytes = (base64Str) => {
  const binaryStr = atob(base64Str);
  const byteArray = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    byteArray[i] = binaryStr.charCodeAt(i);
  }
  return byteArray;
};

module.exports = async function decryptFile(message,type){
  const mediaUrl = message.url || message.deprecatedMms3Url;

  const options = makeOptions();

  if (!mediaUrl)
    throw new Error(
      'message is missing critical data needed to download the file.'
    );
  let haventGottenImageYet = true;
  let res;
  try {
    while (haventGottenImageYet) {
      res = await axios.get(mediaUrl.trim(), options);
      if (res.status == 200) {
        haventGottenImageYet = false;
      } else {
        await timeout(2000);
      }
    }
  } catch (error) {
    throw 'Error trying to download the file.';
  }
  const buff = Buffer.from(res.data, 'binary');
  return magix(buff, message.mediaKey, type, message.fileLength);
};