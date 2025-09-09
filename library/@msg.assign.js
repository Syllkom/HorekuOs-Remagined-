// folder: library

import logger from './fun.p.logger.js';

export default async function (m, sock) {
    try {
        m.type = (msg) => {
              if (msg?.conversation) return 'text';
              if (msg?.extendedTextMessage) return 'extendedText';
              if (msg?.imageMessage) return 'image';
              if (msg?.videoMessage) return 'video';
              if (msg?.documentMessage) return 'document';
              if (msg?.audioMessage) return 'audio';
              if (msg?.stickerMessage) return 'sticker';
              if (msg?.locationMessage) return 'location';
              if (msg?.contactMessage) return 'contact';
              if (msg?.buttonsResponseMessage) return 'buttonsResponse';
              if (msg?.listResponseMessage) return 'listResponse';
              if (msg?.templateButtonReplyMessage) return 'templateButtonReply';
              if (msg?.viewOnceMessage) return 'viewOnce';
              return null;
          }
        m.reply = async (text, footer = global.settings.mainBotName) => {
            if (typeof text == 'string') {
                return await sock.sendWAMContent(m.chat.id, { viewOnceMessage: { message: { interactiveMessage: { header: { title: '', hasMediaAttachment: false }, body: { text: text }, footer: { text: footer }, contextInfo: { mentionedJid: (text.match(/@(\d{0,16})/g) || []).map(v => v.slice(1) + '@s.whatsapp.net') }, carouselMessage: { cards: [] } } } } }, { timestamp: new Date(), quoted: m.message })
            } else return new Error('[E]: m.reply(string ?)')
        }

        m.react = async (text) => {
            const sendReaction = async (text) =>
                await sock.sendMessage(m.chat.id, { react: { text, key: m.message.key } });
            if (text === 'error' || text === 'done' || text === 'wait') {
                const reactions = { 'done': '✔️', 'wait': '⌛', 'error': '✖️' }[text];
                return await sendReaction(reactions);
            } else { return await sendReaction(text) }
        }

        m.sms = (type) => {
            let msg = {
                rowner: 'Este comando solo puede ser utilizado por el *dueño*',
                owner: 'Este comando solo puede ser utilizado por un *propietario*',
                modr: 'Este comando solo puede ser utilizado por un *moderador*',
                premium: 'Esta solicitud es solo para usuarios *premium*',
                group: 'Este comando solo se puede usar en *grupos*',
                private: 'Este comando solo se puede usar por *chat privado*',
                admin: 'Este comando solo puede ser usado por los *administradores del grupo*',
                botAdmin: 'El bot necesita *ser administrador* para usar este comando',
                unreg: 'Regístrese para usar esta función escribiendo:\n\n.registrar nombre.edad',
                restrict: 'Esta función está desactivada'
            }[type]
            if (msg) return m.reply(msg)
        }

    } catch (e) { logger.error(e) }
}