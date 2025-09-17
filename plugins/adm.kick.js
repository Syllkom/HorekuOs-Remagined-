// /plugins/kick.js
export default {
    command: true,
    usePrefix: true,
    case: 'kick',
    script: async (m, { sock }) => {
        // Validaciones
        if (!m.chat.group) return m.sms('group');
        if (!m.sender.admin) return m.sms('admin');
        if (!m.bot.admin) return m.sms('botAdmin');
        
        const user = m.quoted ? m.quoted?.sender.id : m.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
        if (!user) return m.reply('Debes mencionar a alguien o responder a su mensaje para expulsarlo.');

        try {
            await sock.groupParticipantsUpdate(m.chat.id, [user], 'remove')
            await m.react(`done`);
        } catch (e) {
            await m.react(`error`);
            console.error(e);
        }
    }
};