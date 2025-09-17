import $base from '../library/fun.makeDBase.js';

const WELCOME_GIF = "https://files.catbox.moe/s1i963.gif";
const BYE_IMG = "https://files.catbox.moe/42dhvw.jpg";

export default {
    stubtype: true,
    case: [
        'GROUP_PARTICIPANT_ADD',
        'GROUP_PARTICIPANT_REMOVE',
        'GROUP_CHANGE_SUBJECT',
        'GROUP_CHANGE_ICON'
    ],
    script: async (m, { sock, parameters, even }) => {
        const db = await $base.open('system:BUC');
        const chatConfig = db.data['@chats']?.[m.chat.id] || {};
        const groupName = m.chat.name || 'el grupo';

        // --- WELCOME (multientrada) ---
        if (even === 'GROUP_PARTICIPANT_ADD' && chatConfig.welcome) {
            const usersAdded = Array.isArray(parameters) ? parameters : [parameters[0]];
            if (usersAdded.length > 2) {
                const usersList = usersAdded.map(jid => `@${jid.split('@')[0]}`).join(', ');
                const msg = `¡Bienvenid@s ${usersList} a ${groupName}! 🎉`;
                await sock.sendMessage(m.chat.id, {
                    image: { url: WELCOME_GIF },
                    caption: msg,
                    mentions: usersAdded
                });
            } else {
                for (const newUserJid of usersAdded) {
                    if (newUserJid === m.bot.id) continue;
                    const welcomeMessage = `¡Hola @${newUserJid.split('@')[0]}! Bienvenido/a a ${groupName}.`;
                    await sock.sendMessage(m.chat.id, {
                        image: { url: WELCOME_GIF },
                        caption: welcomeMessage,
                        mentions: [newUserJid]
                    });
                }
            }
        }

        // --- BYE (multisalida) ---
        if (even === 'GROUP_PARTICIPANT_REMOVE' && chatConfig.bye) {
            const usersLeft = Array.isArray(parameters) ? parameters : [parameters[0]];
            if (usersLeft.length > 2) {
                const usersList = usersLeft.map(jid => `@${jid.split('@')[0]}`).join(', ');
                const msg = `Adiós ${usersList} 👋, han salido de ${groupName}. ¡Hasta luego!`;
                await sock.sendMessage(m.chat.id, {
                    image: { url: BYE_IMG },
                    caption: msg,
                    mentions: usersLeft
                });
            } else {
                for (const userJid of usersLeft) {
                    if (userJid === m.bot.id) continue;
                    const byeMessage = `@${userJid.split('@')[0]} ha salido de ${groupName}. ¡Hasta luego!`;
                    await sock.sendMessage(m.chat.id, {
                        image: { url: BYE_IMG },
                        caption: byeMessage,
                        mentions: [userJid]
                    });
                }
            }
        }

        // --- NOTIFY: Cambio nombre grupo ---
        if (even === 'GROUP_CHANGE_SUBJECT' && chatConfig.notify) {
            const adminName = m.sender.name;
            const newGroupName = m.chat.name;
            await sock.sendMessage(m.chat.id, {
                text: `ⓘ El administrador ${adminName} ha cambiado el nombre del grupo a: *${newGroupName}*`
            });
        }

        // --- NOTIFY: Cambio icono grupo ---
        if (even === 'GROUP_CHANGE_ICON' && chatConfig.notify) {
            const adminName = m.sender.name;
            await sock.sendMessage(m.chat.id, {
                text: `ⓘ El administrador ${adminName} ha cambiado la foto del grupo.`
            });
        }
    }
}