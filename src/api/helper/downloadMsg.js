const { downloadContentFromMessage } = require('@adiwajshing/baileys')
const logger = require('pino')()

module.exports = async function downloadMessage(msg, msgType) {
    let buffer = Buffer.from([])
    try {
        const stream = await downloadContentFromMessage(msg, msgType)
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }
    } catch {
        return logger.info('error downloading file-message')
    }
    return buffer.toString('base64')
}
