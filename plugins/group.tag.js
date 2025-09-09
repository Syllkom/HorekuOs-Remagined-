export default {
    command: true,
    usePrefix: true,
    case: ['hidetag', 'tag'],
    script: async (m, { sock }) => {
    if (!m.chat.group) return m.sms('group')
    if (!m.sender.admin) return m.sms('admin')

    const participants = m.chat.participants.map(a => a.id)
    const contextInfo = { mentionedJid: participants }

    if (m.quoted) {
        const type = m.SMS().message;
        if (type['imageMessage']) {
            let media = await sock.download();
            await sock.sendMessage(m.chat.id, { image: media, caption: m.text || '', contextInfo }, { quoted: m, ephemeralExpiration: 24 * 60 * 100, disappearingMessagesInChat: 24 * 60 * 100 })
        } else if (type['videoMessage']) {
            let media = await sock.download();
            await sock.sendMessage(m.chat.id, { video: media, caption: m.text || '', contextInfo }, { quoted: m, ephemeralExpiration: 24 * 60 * 100, disappearingMessagesInChat: 24 * 60 * 100 })
        } else if (type['stickerMessage']) {
            let media = await sock.download();
            await sock.sendMessage(m.chat.id, { sticker: media, contextInfo }, { quoted: m, ephemeralExpiration: 24 * 60 * 100, disappearingMessagesInChat: 24 * 60 * 100 })
        } else if (type['audioMessage']) {
            let media = await sock.download();
            await sock.sendMessage(m.chat.id, { audio: media, contextInfo }, { quoted: m, ephemeralExpiration: 24 * 60 * 100, disappearingMessagesInChat: 24 * 60 * 100 })
        } else if (type['conversation']) {
            await sock.sendMessage(m.chat.id, { text: m.quoted.message.conversation, contextInfo }, { quoted: m, ephemeralExpiration: 24 * 60 * 100, disappearingMessagesInChat: 24 * 60 * 100 })
        } else {
            await m.react('❗')
            return await m.reply('No se puede enviar este tipo de archivo.')
        }
    } else if (m.text) {
        await sock.sendMessage(m.chat.id, { text: m.text, contextInfo }, { ephemeralExpiration: 24 * 60 * 100, disappearingMessagesInChat: 24 * 60 * 100 })
    } else {
        return m.reply(`Y el texto o archivo?`)
    }
    }
}
