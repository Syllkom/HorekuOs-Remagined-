// folder: source

import util from 'util';
import moment from 'moment-timezone';
import lodash from 'lodash';
import chalk from 'chalk';

// libreria
import $Message from '../library/@msg.assign.js';
import $console from '../library/fun.p.logger.js';
import $base from '../library/fun.makeDBase.js';
import { TmpStore } from '../library/utils.js'

const cached = {}
const store = new TmpStore(1000 * 60 * 2);
const memoAsync = async (string, fun) => {
    if (store.has(string))
        return store.get(string);
    const result = await fun()
    store.set(string, result);
    return result;
}

const { proto } = (await import('@whiskeysockets/baileys')).default;

export default async (messages, sock) => {
    cached.group = {
        photo: async (id, type) => {
            return await memoAsync(`${id}-${type}-photo`, async () =>
                await sock.profilePictureUrl(id, type).catch(_ =>
                    'https://files.catbox.moe/obz4b4.jpg'));
        },
        metaData: async (id) => {
            if (!id) return {};
            if (id.endsWith('@s.whatsapp.net')) return {}
            return await memoAsync(`${id}-metaData`, async () =>
                await sock.groupMetadata(id).catch(e => ({})))
        },
        inviteCode: async (id) => {
            return memoAsync(`${id}-inviteCode`, async () =>
                await sock.groupInviteCode(id))
        },
        inviteLink: async (id) => {
            return await memoAsync(`${id}-inviteLink`, async () =>
                `https://chat.whatsapp.com/${await cached
                    .grupo.inviteCode(id)}`);
        }
    }
    cached.sender = {
        photo: async (id, type) => {
            return await memoAsync(`${id}-${type}-photo`, async () =>
                await sock.profilePictureUrl(id, type).catch(_ =>
                    'https://files.catbox.moe/obz4b4.jpg'));
        },
        desc: async (id) => {
            return await memoAsync(`${id}-desc`, async () =>
                (await sock.fetchStatus(id) || {})
                    .status || 'undefined')
        }
    }


    for (const message of messages.messages) {
        if (!message.key) continue;

        // console.log(JSON.stringify(message, null, 2))

        const data = { message: message }

        data.download = async (message, type = 'buffer') => {
            if (!message) message = data.message;
            return await sock.downloadMedia(message, type)
        }

        data.type = (message = {}, object = false) => {
            if (!object) return Object.keys(message)[0]
            else return Object.keys(message)
                .find(o => o == object)
        }

        data.chat = {
            id: message.key.remoteJid || message.key.participant,
            get group() { return this.id.endsWith('@g.us') },
        }

        if (data.chat.group) {
            Object.assign(data.chat, {
                add: async (user) =>
                    await sock.groupParticipantsUpdate(data.chat.id, [user], 'add'),
                remove: async (user) =>
                    await sock.groupParticipantsUpdate(data.chat.id, [user], 'remove'),
                promote: async (user) =>
                    await sock.groupParticipantsUpdate(data.chat.id, [user], 'promote'),
                demote: async (user) =>
                    await sock.groupParticipantsUpdate(data.chat.id, [user], 'demote'),
                photo: async (type = 'image', id) =>
                    await cached.group.photo(id ?? data.chat.id, type),
                invite: {
                    code: async () => await cached.group.inviteCode(data.chat.id),
                    link: async () => await cached.group.inviteLink(data.chat.id),
                    revoke: async () => await sock.groupRevokeInvite(data.chat.id)
                },
                settings: {
                    lock: async (bool) =>
                        await sock.groupSettingUpdate(data.chat.id, bool ? 'locked' : 'unlocked'),
                    announce: async (bool) =>
                        await sock.groupSettingUpdate(data.chat.id, bool ? 'announcement' : 'not_announcement'),
                    member_add: async (bool) =>
                        await sock.groupSettingUpdate(data.chat.id, bool ? 'all_member_add' : 'admin_add'),
                    join_approval: async (bool) =>
                        await sock.groupJoinApprovalMode(data.chat.id, bool ? 'on' : 'off')
                },
                update: {
                    name: async (text) => await sock.groupUpdateSubject(data.chat.id, text),
                    desc: async (text) => await sock.groupUpdateDescription(data.chat.id, text),
                    photo: async (image, type = 'normal') =>
                        type === 'normal' ? await sock.updateProfilePicture(data.chat.id, image)
                            : await sock.query({
                                tag: 'iq',
                                attrs: {
                                    target: data.chat.id,
                                    to: '@s.whatsapp.net',
                                    type: 'set',
                                    xmlns: 'w:profile:picture'
                                },
                                content: [{
                                    tag: 'picture',
                                    attrs: { type: 'image' },
                                    content: await sock.resizePhoto({ image: image, scale: 720, result: 'buffer' })
                                }]
                            })
                }
            });
        }

        // Asignar bot
        data.bot = {
            id: sock.user.id.split(":")[0] + "@s.whatsapp.net",
            get number() { return this.id.split('@')[0] || undefined },
            get name() { return sock.user.name || '' },
            get fromMe() { return message.key.fromMe },
            async role(...array) {
                return array.some(role => this[role]);
            },
            async photo(type = 'image', id = this.id) {
                return await cached.sender.photo(id, type);
            },
            async desc() {
                return await cached.sender.desc(this.id);
            },
            async join(link) {
                const match = link.match(/(?:https?:\/\/)?chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
                if (!match) throw new Error('Invalid invite link');
                return await sock.groupAcceptInvite(match[1]);
            },
            async mute(id, Boolean, time = 1000 * 60 * 60 * 8) {
                if (Boolean) await sock.chatModify({ mute: time }, id, []);
                else await sock.chatModify({ mute: null }, id, []);
            },
            async block(id, Boolean) {
                if (Boolean) await sock.updateBlockStatus(id, 'block');
                else await sock.updateBlockStatus(id, 'unblock');
            },
            update: {
                async name(text) {
                    return await sock.updateProfileName(text);
                },
                async desc(text) {
                    return await sock.updateProfileStatus(text);
                },
                async photo(image, type = 'normal') {
                    return type == 'normal'
                        ? await sock.updateProfilePicture(this.id, image)
                        : await sock.query({
                            tag: 'iq',
                            attrs: {
                                to: '@s.whatsapp.net',
                                type: 'set',
                                xmlns: 'w:profile:picture'
                            },
                            content: [{
                                tag: 'picture',
                                attrs: { type: 'image' },
                                content: await sock.resizePhoto({ image: image, scale: 720, result: 'buffer' })
                            }]
                        });
                }
            }
        }

        // Asignar emisor
        data.sender = {
            id: data.bot.fromMe ? data.bot.id : (message.key.remoteJid.endsWith('@s.whatsapp.net')
                ? message.key.remoteJid : message.key.participantPn ?? message.key.participant),
            get number() {
                return (this.id)?.split('@')[0] || undefined;
            },
            get name() {
                return data.bot.fromMe ? data.bot.name : message.pushName || '';
            },
            get bot() { return data.bot.id === this.id },
            async role(...array) { return array.some(role => this[role]); },
            async photo(type = 'image') { return await cached.sender.photo(this.id, type); },
            async desc() { return await cached.sender.desc(this.id); }
        }

        const db = await $base.open('system:BUC')

        // Asignar bot
        if (!db.data['@bot']) db.data['@bot'] = {}
        if (!db.data['@bot'][data.bot.id])
            db.data['@bot'][data.bot.id] = {}

        // Asignar user
        if (!db.data['@users']) db.data['@users'] = {}
        const value = data.bot.id == data.sender.id ? true : false
        if (!db.data['@users'][data.sender.id]) db.data['@users'][data.sender.id] = {
            name: data.sender.name,
            banned: false,
            roles: {
                rowner: value,
                owner: value,
                modr: value,
                prem: value,
            }
        }

        // Asignar chat
        if (!db.data['@chats']) db.data['@chats'] = {}
        if (!db.data['@chats'][data.chat.id])
            db.data['@chats'][data.chat.id] = {
                banned: false
            }
        await db.update()

        /* // data
         Object.assign(data.bot, {
             ban: {
                 chat: async (id) => {
                     db.data['@chats']
                     [id ?? message.chat.id]
                         .banned = true
                     await db.update()
                     return true
                 },
                 user: async () => {
                     db.data['@users']
                     [id].banned = true
                     await db.update()
                     return true
                 }
             }
         })*/



        // ASSIGN ROLE SENDER
        try {
            const users = db.data['@users']
            if (global.settings.SetUsetRoles[data.sender.number])
                Object.assign(users[data.sender.id].roles, {
                    ...global.settings.SetUsetRoles
                    [data.sender.number]
                })
            Object.assign(data.sender,
                users[data.sender.id].roles || {})
            await db.update()
        } catch (e) {
            $console.error(e)
        }


        //LEER MENSAJE DESDE EL BOT
        if (!sock.subBot && global.settings['mainBotAuto-read'])
            await sock.readMessages([message.key])

        //LEER MENSAJE DESDE UN SUBBOT
        if (sock.subBot && global.settings['subBotAuto-read'])
            await sock.readMessages([message.key])

        await $Message(data, sock);

        // index: 1
        try {
            let control = { end: false };
            const plugins = await sock.plugins.get({
                before: true, index: 1
            });
            for (let plugin of plugins) {
                if (control.end) break;
                await plugin.script(data, {
                    sock: sock,
                    plugin: sock.plugins,
                    store: sock.store,
                    control: control
                });
            }
            if (control.end) return;
        } catch (e) {
            $console.error(e);
        }

        if (data.chat.group) Object.assign(data.chat, {
            metaData: await cached.group.metaData(data.chat.id),
            get size() { return this.metaData.size || 0 },
            get desc() { return this.metaData.desc || '' },
            get name() { return this.metaData.subject || '' },
            get created() { return this.metaData.creation || 0 },
            get participants() { return this.metaData.participants || [] },
            get owner() {
                return this.metaData.owner || this.metaData
                    .subjectOwner || 'undefined'
            },
            get admins() {
                return this.participants.filter(o => ['admin', 'superadmin']
                    .some(_ => _ === o.admin)).map(v => v.id) || []
            }
        })

        if (data.chat.group) {
            data.sender.admin = data.chat.admins.includes(data.sender.id) || false
            data.bot.admin = data.chat.admins.includes(data.bot.id) || false
        }

        if (message.messageStubType) {
            const even = proto.WebMessageInfo.StubType
            const evento = Object.keys(even).find(key =>
                even[key] === message.messageStubType)
            const plugins = await sock.plugins.get({
                case: evento,
                stubtype: true
            })
            if (plugins[0]) await plugins[0].script(data, {
                parameters: message.messageStubParameters,
                plugin: sock.plugins,
                store: sock.store,
                even: evento,
                sock: sock,
            })
            else {
                $console.log(chalk.white('['),
                    chalk.magenta(moment().tz(Intl.DateTimeFormat()
                        .resolvedOptions().timeZone).format('HH:mm:ss')).trim(),
                    chalk.white(']'), chalk.blue('STUBTYPE:'),
                    chalk.rgb(0, 217, 255).underline(JSON.stringify({
                        even: evento, parameters: message.messageStubParameters
                    }, 0, 2)))
                continue;
            }

            if (plugins[0]) continue;
        }

        // index: 2
        try {
            let control = { end: false };
            const plugins = await sock.plugins.get({
                before: true, index: 2
            });
            for (let plugin of plugins) {
                if (control.end) break;
                await plugin.script(data, {
                    sock: sock,
                    plugin: sock.plugins,
                    store: sock.store,
                    control: control
                });
            }
            if (control.end) return;
        } catch (e) {
            $console.error(e);
        }

        if (!data.message.message) continue;

        const MESSAGE_EXTRACT = {
            'conversation': (message) => message.conversation || '',
            'imageMessage': (message) => message.imageMessage.caption || '',
            'videoMessage': (message) => message.videoMessage.caption || '',
            'extendedTextMessage': (message) => message.extendedTextMessage.text || '',
            'buttonsResponseMessage': (message) => message.buttonsResponseMessage.selectedButtonId || '',
            'templateButtonReplyMessage': (message) => message.templateButtonReplyMessage.selectedId || '',
            'interactiveResponseMessage': (message) => message.interactiveResponseMessage ? (JSON.parse(message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson)).id || '' : '',
        }

        const VALID_MESSAGE_TYPES = Object.keys(MESSAGE_EXTRACT);

        const MESSAGE_TYPE = (() => {
            for (const type of VALID_MESSAGE_TYPES) {
                if (data.message.message[type]) return type;
            }
        })()

        const MESSAGE_CONTENT = data.message.message[MESSAGE_TYPE]
        const CONTEXT_INFO = MESSAGE_CONTENT?.contextInfo || {}

        if (CONTEXT_INFO && CONTEXT_INFO?.quotedMessage) {
            data.sender.mentioned = CONTEXT_INFO.mentionedJid || []
            if (!data.quoted) data.quoted ||= {}
            if (!data.quoted.message)
                data.quoted.message ||= {}

            data.quoted.message.key = {
                remoteJid: CONTEXT_INFO.remoteJid || data.chat.id,
                fromMe: CONTEXT_INFO.participant == data.bot.id,
                participant: CONTEXT_INFO.participant,
                id: CONTEXT_INFO.stanzaId
            }
            data.quoted.message.message = {
                ...MESSAGE_CONTENT.contextInfo.quotedMessage
            }
            const quotedMessage = data.quoted.message

            data.quoted.download = async (message, type = 'buffer') => {
                if (!message) message = data.quoted.message;
                return await sock.downloadMedia(message, type)
            }

            data.quoted.sender = {
                id: quotedMessage.key.participant
                    ? quotedMessage.key.participant : quotedMessage.key.id,
                get number() { return this.id.split('@')[0] || undefined },
                get bot() { return (data.bot.id + "@s.whatsapp.net") == this.id },
                async photo(type = 'image') { return await cached.sender.photo(this.id, type) },
                async desc() { return await cached.sender.desc(this.id) }
            }
        }

        const extractBody = (message) => {
            try {
                return MESSAGE_EXTRACT[MESSAGE_TYPE](message) || '';
            } catch (e) {
                return '';
            }
        }

        data.body = extractBody(data.message.message);

        if (data.quoted && data.body) await (async () => {
            const db = await $base.open('system:SMIFR')
            if (!db.data[CONTEXT_INFO.stanzaId]) return;
            const resCmd = structuredClone(db.data[CONTEXT_INFO.stanzaId])
            resCmd.response = await Promise.all(resCmd.response.map(async (o) =>
                Object.fromEntries(await Promise.all(Object.entries(o)
                    .map(async ([key, value]) => {
                        if (key == 'extract' && (/=>/g).test(value)) value = eval(value)
                        if (key == 'condition' && (/=>/g).test(value)) value = eval(value)
                        if (key == 'command' && (/=>/g).test(value)) value = eval(value)
                        return [key, value];
                    })))
            ))

            if (!(resCmd.user === 'all' || resCmd.user === data.sender.id)) return;
            if (resCmd.once) delete db.data[CONTEXT_INFO.stanzaId]
            for (const response of resCmd.response) {
                if (await response.condition(data, { response })) {
                    if (response.dynamic && response.extract && typeof response.command === 'function') {
                        return data.body = await response.command(await response.extract(data, { response }))
                    } else if (typeof response.command === 'string') {
                        return data.body = response.command
                    }
                }
            }
            await db.update()
        })()


        data.tag = data.body ?
            (data.body.match(/tag=[^ ]+/g) || [])
                .map(tag => tag.split('=')[1]) : [];

        data.body = data.tag.length > 0
            ? data.body.replace(/tag=[^\s]+/g, '')
                .replace(/\s+/g, ' ').trim() : data.body || '';

        data.args = data.body.trim().split(/ +/).slice(1)
        data.text = data.args.length > 0 ? data.args.join(" ") : null;

        if (global.settings.mainBotPrefix) {

            data.command = data.body.substring(1).trim()
                .split(/ +/)[0].toLowerCase()

            const plugin = await sock.plugins.get({
                case: data.command,
                usePrefix: true,
                command: true,
            })

            data.isCmd = plugin[0] ? true : false;
            data.plugin = plugin[0] ?? null;

            if (!data.isCmd) {
                data.command = data.body.trim()
                    .split(/ +/)[0].toLowerCase()

                const plugin = await sock.plugins.get({
                    case: data.command,
                    usePrefix: false,
                    command: true,
                })
                data.isCmd = plugin[0] ? true : false;
                data.plugin = plugin[0] ?? null;
            }
        } else {
            data.command = data.body.trim()
                .split(/ +/)[0].toLowerCase()
            const plugin = await sock.plugins.get({
                case: data.command,
                command: true
            })
            data.isCmd = plugin[0] ? true : false;
            data.plugin = plugin[0] ?? null;
        }

        $console.log(chalk.white('['), chalk.magenta(moment().tz(Intl.DateTimeFormat().resolvedOptions().timeZone).format('HH:mm:ss')).trim(), chalk.white(']'), chalk.blue(data.isCmd ? `COMANDO:` : `MENSAJE:`), chalk.green('{'), chalk.rgb(255, 131, 0).underline(data.body == '' ? data.type(data.message.message) + '' : data.body), chalk.green('}'), chalk.blue(data.isCmd ? 'Por' : 'De'), chalk.cyan(data.sender.name), 'Chat', data.chat.group ? chalk.bgGreen('grupo:' + (data.chat.name || data.chat.id)) : chalk.bgRed('Privado:' + data.sender.name || data.sender.id))

        // index: 3
        try {
            let control = { end: false };
            const plugins = await sock.plugins.get({
                before: true, index: 3
            });
            for (let plugin of plugins) {
                if (control.end) break;
                await plugin.script(data, {
                    sock: sock,
                    plugin: sock.plugins,
                    store: sock.store,
                    control: control
                });
            }
            if (control.end) return;
        } catch (e) {
            $console.error(e);
        }

        try {
            if (data.plugin) return await data
                .plugin.script(data, {
                    plugin: sock.plugins,
                    store: sock.store,
                    sock: sock,
                })
        } catch (e) {
            $console.log(chalk.white('['),
                chalk.redBright('ERROR'),
                chalk.white(']'),
                chalk.redBright('Error:'),
                util.format(e))
            await data.react('error')
            return await sock.sendMessage(data.chat.id, { text: (`*[ Evento - ERROR ]*\n\n- Comando:* ${global.prefix + data.command}\n- Usuario:* wa.me/${data.sender.number}\n- Chat:* ${data.chat.id}\n${global.readMore}\n*\`[ERORR]\`:* ${util.format(e)}\n`) }, { quoted: data.message })
        }
    }
}