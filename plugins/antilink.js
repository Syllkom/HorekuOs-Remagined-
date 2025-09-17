import $base from '../library/fun.makeDBase.js';

const REGEX = {
    wa_group: /chat\.whatsapp\.com\/([A-Za-z0-9]+)/i,
    wa_channel: /whatsapp\.com\/channel\/[A-Za-z0-9]+/i,
    ig: /(?:instagram\.com|ig\.me)\/[a-zA-Z0-9._%-]+/i,
    fb: /facebook\.com\/[A-Za-z0-9._%-]+/i,
    x: /(?:twitter\.com|x\.com)\/[A-Za-z0-9._%-]+/i,
    threads: /threads\.net\/[a-zA-Z0-9._%-]+/i,
    tg: /t\.me\/[a-zA-Z0-9._%-]+/i,
    any: /https?:\/\/[^\s]+/i
};

const COMMAND_PREFIXES = [
    '.',
    '!',
    '/',
    '#'
];

const COMMAND_WHITELIST = [
    'tt', 'tthd', 'yt', 'fbdown', 'play', 'ytmp4', 'ytmp3', 'yta', 'ytv', 'ig', 'instagram', 'mp4', 'mp3', 'video', 'audio', 'tiktok', 'fb', 'facebook', 'titkok'
];

function isCommandLink(message) {
    const trimmed = message.trim();
    for (const prefix of COMMAND_PREFIXES) {
        if (trimmed.startsWith(prefix)) {
            const [, cmd] = trimmed.match(new RegExp(`^\\${prefix}\\s*(\\w+)`)) || [];
            if (cmd && COMMAND_WHITELIST.includes(cmd.toLowerCase())) return true;
        }
    }
    return false;
}

export default {
    before: true,
    index: 3,
    script: async (m, { control, sock }) => {
        if (!m.chat.group) return;

        const db = await $base.open('system:BUC');
        const chatConfig = db.data['@chats']?.[m.chat.id] || {};
        if (!chatConfig.antilink || m.sender.admin || m.sender.owner) return;

        if (m.body && isCommandLink(m.body)) return;

        const tests = [
            { key: 'wa_group', regex: REGEX.wa_group, on: chatConfig.antilink_wa_group },
            { key: 'wa_channel', regex: REGEX.wa_channel, on: chatConfig.antilink_channel },
            { key: 'ig', regex: REGEX.ig, on: chatConfig.antilink_ig },
            { key: 'fb', regex: REGEX.fb, on: chatConfig.antilink_fb },
            { key: 'x', regex: REGEX.x, on: chatConfig.antilink_x },
            { key: 'threads', regex: REGEX.threads, on: chatConfig.antilink_threads },
            { key: 'tg', regex: REGEX.tg, on: chatConfig.antilink_tg },
            { key: 'any', regex: REGEX.any, on: chatConfig.antilink_any }
        ];

        for (const test of tests) {
            if (!test.on) continue;
            if (m.body && test.regex.test(m.body)) {
                if (test.key === 'wa_group') {
                    const match = m.body.match(REGEX.wa_group);
                    if (match && m.chat.invite && match[1] === m.chat.invite) {
                        await m.reply('😂👍 ¡Eso es el link de este grupo! Buen intento.');
                        return;
                    } else {
                        await m.chat.remove(m.sender.id);
                        if (m.message && m.message.key) {
                            await sock.sendMessage(m.chat.id, { delete: m.message.key });
                        }
                        await m.reply('Usuario eliminado y mensaje borrado por compartir links de otros grupos.');
                        control.end = true;
                        return;
                    }
                } else {
                    // All link's
                    await m.chat.remove(m.sender.id);
                    if (m.message && m.message.key) {
                        await sock.sendMessage(m.chat.id, { delete: m.message.key });
                    }
                    await m.reply('Usuario eliminado y mensaje borrado por compartir enlaces prohibidos.');
                    control.end = true;
                    return;
                }
            }
        }
    }
}