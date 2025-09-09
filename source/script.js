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

        if (data.chat.group) Object.assign(data.chat, {
            add: async (user) => await sock.groupParticipantsUpdate(this.id, [user], 'add'),
            remove: async (user) => await sock.groupParticipantsUpdate(this.id, [user], 'remove'),
            promote: async (user) => await sock.groupParticipantsUpdate(this.id, [user], 'promote'),
            demote: async (user) => await sock.groupParticipantsUpdate(this.id, [user], 'demote'),
            photo: async (type = 'image', id) => cached.group.photo(id ?? this.id, type),
            invite: {
                code: async () => await cached.group.inviteCode(this.id),
                link: async () => await cached.group.inviteLink(this.id),
                revoke: async () => await sock.groupRevokeInvite(this.id)
            },
            settings: {
                lock: async (bool) => await sock.groupSettingUpdate
                    (this.id, bool ? 'locked' : 'unlocked'),
                announce: async (bool) => await sock.groupSettingUpdate
                    (this.id, bool ? 'announcement' : 'not_announcement'),
                member_add: async (bool) => await sock.groupSettingUpdate
                    (this.id, bool ? 'all_member_add' : 'admin_add'),
                join_approval: async (bool) => await sock.groupJoinApprovalMode
                    (this.id, bool ? 'on' : 'off')
            },
            update: {
                name: async (text) => await sock.groupUpdateSubject(this.id, text),
                desc: async (text) => await sock.groupUpdateDescription(this.id, text),
                photo: async (image, type = 'normal') =>
                    type === 'normal' ? await sock.updateProfilePicture(this.id, image)
                        : await sock.query({ tag: 'iq', attrs: { target: this.id, to: '@s.whatsapp.net', type: 'set', xmlns: 'w:profile:picture' }, content: [{ tag: 'picture', attrs: { type: 'image' }, content: await sock.resizePhoto({ image: image, scale: 720, result: 'buffer' }) }] })
            }
        })

        // Asignar bot
        data.bot = {
            id: sock.user.id.split(":")[0] + "@s.whatsapp.net",
            get number() { return this.id.split('@')[0] || undefined },
            get name() { return sock.user.name || '' },
            get fromMe() { return message.key.fromMe },
            async role(...array) {
                return array.some(role => data.bot[role])
            },
            async photo(type = 'image', id = data.bot.id) {
                return await cached.sender.photo(id, type)
            },
            async desc() {
                await cached.sender.desc(m.id)
            },
            async join(link) {
                if (typeof link !== 'string') throw new Error('Invalid invite link');
                const match = link.match(/(?:https?:\/\/)?chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
                if (!match) throw new Error('Invalid invite link');
                return await sock.groupAcceptInvite(match[1])
            },

            async mute(id, Boolean, time = 1000 * 60 * 60 * 8) {
                if (typeof id !== 'string') throw new Error('Invalid user ID');
                if (Boolean) await sock.chatModify({ mute: time }, id, [])
                else await sock.chatModify({ mute: null }, id, [])
            },

            async block(id, Boolean) {
                if (typeof id !== 'string') throw new Error('Invalid user ID');
                if (Boolean) await sock.updateBlockStatus(id, 'block')
                else await sock.updateBlockStatus(id, 'unblock')
            },
            update: {
                async name(text) {
                    return await sock.updateProfileName(text)
                },
                async desc(text) {
                    return await sock.updateProfileStatus(text)
                },
                async photo(image, type = 'normal') {
                    return type == 'normal'
                        ? await sock.updateProfilePicture(m.id, image)
                        : await sock.query({ tag: 'iq', attrs: { to: '@s.whatsapp.net', type: 'set', xmlns: 'w:profile:picture' }, content: [{ tag: 'picture', attrs: { type: 'image' }, content: await sock.resizePhoto({ image: image, scale: 720, result: 'buffer' }) }] })
                }
            }
        }

        // Asignar emisor
        data.sender = {
            id: data.bot.fromMe ? data.bot.id : (message.key.remoteJid.endsWith('@s.whatsapp.net')
                ? message.key.remoteJid : message.key.participant),
            get number() {
                return (this.id).split('@')[0] || undefined
            },
            get name() {
                return data.bot.fromMe ? data.bot.name : message.pushName || ''
            },
            get bot() { return (data.bot.id) == this.id },
            async role(...array) { return array.some(role => data.sender[role]) },
            async photo(type = 'image') { return await cached.sender.photo(this.id, type) },
            async desc() { return await cached.sender.desc(this.id) }
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

        const MESSAGE_TYPE = VALID_MESSAGE_TYPES.find(type =>
            type in data.message.message)

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
            return MESSAGE_EXTRACT[MESSAGE_TYPE](message) || '';
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

        const TUTORIAL_TEXT = `#################################################################
#                                                               #
#          TUTORIAL PARA LA CREACIÓN DE PLUGINS DEL BOT         #
#                                                               #
#################################################################

Bienvenido a la guía de desarrollo para tu bot. Este sistema de plugins te permite
añadir nuevas funcionalidades de forma modular y organizada. Cada archivo \`.js\`
dentro de la carpeta \`/plugins\` es un plugin independiente.

---

### ÍNDICE

1.  Estructura Básica de un Plugin
2.  El Objeto \`m\` (o \`data\`): El Corazón de tu Plugin
    -   Propiedades Principales
    -   \`m.chat\`: Información y Acciones del Chat
    -   \`m.sender\`: Información y Acciones del Remitente
    -   \`m.bot\`: Información y Acciones del Bot
    -   \`m.quoted\`: Información del Mensaje Citado
    -   Helpers: \`m.reply\`, \`m.react\`, \`m.sms\`
3.  Propiedades del Plugin (El "Encabezado")
    -   \`command\`: Para comandos de texto.
    -   \`stubtype\`: Para eventos de grupo.
    -   \`before\`: Para ejecutar código antes de los comandos (middleware).
    -   \`export\`: Para compartir funciones entre plugins.
4.  Ejemplos Completos
    -   Comando simple: !ping
    -   Comando con argumentos: !say
    -   Comando de administrador: !kick
    -   Evento de bienvenida (stubtype)
    -   Middleware de registro (before)
    -   Sistema de export/import

---

### 1. ESTRUCTURA BÁSICA DE UN PLUGIN

Todos los plugins deben exportar un objeto por defecto. La propiedad más importante es \`script\`, que es la función que se ejecutará.

\`\`\`javascript
// /plugins/mi-plugin.js

export default {
    // Aquí van las propiedades del plugin (ver sección 3)
    command: true,
    usePrefix: true,
    case: ['ping', 'test'],

    // Esta es la función principal que se ejecuta
    script: async (m, { sock, plugin }) => {
        // Tu código va aquí
        await m.reply('Pong!');
    }
};
\`\`\`
-   \`m\`: El objeto principal con toda la información del mensaje (ver sección 2).
-   \`sock\`: El objeto de la conexión de Baileys, con todas las funciones de bajo nivel.
-   \`plugin\`: El manejador de plugins, útil para importar desde otros plugins.

---

### 2. EL OBJETO \`m\` (o \`data\`): EL CORAZÓN DE TU PLUGIN

El primer argumento de tu \`script\`, llamado \`m\` (o \`data\`), contiene todo lo que necesitas saber sobre el mensaje entrante.

#### Propiedades Principales:

-   \`m.body\`: (String) El contenido de texto del mensaje.
-   \`m.command\`: (String) El comando extraído del \`body\` (ej: 'ping').
-   \`m.text\`: (String) El resto del mensaje después del comando.
-   \`m.args\`: (Array<String>) \`m.text\` dividido por espacios.
-   \`m.isCmd\`: (Boolean) \`true\` si el mensaje fue identificado como un comando.
-   \`m.plugin\`: (Object) El objeto del plugin que se está ejecutando.
-   \`m.message\`: (Object) El objeto de mensaje crudo de Baileys.
-   \`m.download()\`: (Function) Descarga el adjunto del mensaje. \`await m.download()\` devuelve un Buffer.

#### \`m.chat\`: Información y Acciones del Chat

Contiene información sobre el chat donde se envió el mensaje.

-   \`m.chat.id\`: (String) El JID del chat (ej: '12345@c.us' o '12345-6789@g.us').
-   \`m.chat.group\`: (Boolean) \`true\` si el chat es un grupo.

**Propiedades y métodos solo para grupos (\`if (m.chat.group)\`):**
-   \`m.chat.name\`: (String) El nombre del grupo.
-   \`m.chat.desc\`: (String) La descripción del grupo.
-   \`m.chat.participants\`: (Array) Lista de participantes.
-   \`m.chat.admins\`: (Array<String>) Lista de JIDs de los administradores.
-   \`m.chat.owner\`: (String) El JID del dueño del grupo.
-   \`m.chat.promote(userJid)\`: Promueve a un usuario a administrador.
-   \`m.chat.demote(userJid)\`: Degrada a un administrador a miembro.
-   \`m.chat.remove(userJid)\`: Expulsa a un usuario.
-   \`m.chat.photo('image' | 'preview')\`: Obtiene la URL de la foto del grupo.
-   \`m.chat.settings.lock(true|false)\`: Cierra o abre el grupo.
-   \`m.chat.settings.announce(true|false)\`: Activa o desactiva el modo "solo admins".
-   \`m.chat.update.name(new_name)\`: Cambia el nombre del grupo.
-   \`m.chat.update.desc(new_desc)\`: Cambia la descripción del grupo.

#### \`m.sender\`: Información y Acciones del Remitente

-   \`m.sender.id\`: (String) El JID de quien envió el mensaje.
-   \`m.sender.name\`: (String) El nombre de perfil (pushName).
-   \`m.sender.number\`: (String) El número de teléfono sin el \`@s.whatsapp.net\`.
-   \`m.sender.admin\`: (Boolean) \`true\` si el remitente es admin del grupo (solo en grupos).
-   \`m.sender.rowner\`: (Boolean) \`true\` si es el dueño principal del bot.
-   \`m.sender.owner\`: (Boolean) \`true\` si es un propietario.
-   \`m.sender.modr\`: (Boolean) \`true\` si es un moderador.
-   \`m.sender.prem\`: (Boolean) \`true\` si es un usuario premium.
-   \`m.sender.photo('image' | 'preview')\`: Obtiene la URL de la foto de perfil del remitente.
-   \`m.sender.desc()\`: Obtiene el "info" o estado de WhatsApp del remitente.

#### \`m.bot\`: Información y Acciones del Bot

-   \`m.bot.id\`: (String) El JID del bot.
-   \`m.bot.name\`: (String) El nombre del bot.
-   \`m.bot.admin\`: (Boolean) \`true\` si el bot es admin del grupo (solo en grupos).
-   \`m.bot.fromMe\`: (Boolean) \`true\` si el mensaje fue enviado por el bot.
-   \`m.bot.block(userJid, true|false)\`: Bloquea o desbloquea a un usuario.
-   \`m.bot.join(link)\`: Se une a un grupo usando un enlace de invitación.

#### \`m.quoted\`: Información del Mensaje Citado

Este objeto solo existe si el mensaje es una respuesta a otro.
-   \`m.quoted.message\`: (Object) El objeto del mensaje citado.
-   \`m.quoted.sender.id\`: (String) El JID de quien envió el mensaje original.
-   \`m.quoted.download()\`: (Function) Descarga el adjunto del mensaje citado.

#### Helpers: \`m.reply\`, \`m.react\`, \`m.sms\`

Estas son funciones de conveniencia añadidas a \`m\`.
-   \`m.reply(text)\`: Responde al mensaje actual.
-   \`m.react(emoji)\`: Reacciona al mensaje. Puedes usar emojis directos ('👍') o alias ('wait', 'done', 'error').
-   \`m.sms(type)\`: Envía mensajes predefinidos para comprobaciones de permisos.
    -   \`type\` puede ser: \`rowner\`, \`owner\`, \`modr\`, \`premium\`, \`group\`, \`private\`, \`admin\`, \`botAdmin\`, \`unreg\`, \`restrict\`.

---

### 3. PROPIEDADES DEL PLUGIN (EL "ENCABEZADO")

Estas propiedades se definen en el objeto exportado y controlan cómo y cuándo se ejecuta tu plugin.

#### \`command: true\`
-   **Propósito:** Define que este plugin es un comando que se activa por texto.
-   **Propiedades adicionales:**
    -   \`usePrefix: true | false\`: Si \`true\`, el comando necesita un prefijo (ej: \`!ping\`). Si \`false\`, no lo necesita (ej: \`ping\`).
    -   \`case: 'comando' | ['comando', 'alias1']\`: El nombre (o nombres) que activan el comando.

#### \`stubtype: true\`
-   **Propósito:** Se activa por eventos de grupo (unirse, salir, cambio de nombre, etc.) en lugar de mensajes de texto.
-   **Propiedades adicionales:**
    -   \`case: 'EVENTO'\`: El nombre del evento de \`proto.WebMessageInfo.StubType\`.
-   **Contexto Adicional:** El \`script\` recibe un objeto adicional con \`{ parameters, even }\`. \`parameters\` contiene los JIDs de los usuarios involucrados y \`even\` el nombre del evento.

**Ejemplo de \`case\` para \`stubtype\`:**
- \`GROUP_PARTICIPANT_ADD\`: Un usuario se une o es añadido.
- \`GROUP_PARTICIPANT_REMOVE\`: Un usuario sale o es expulsado.
- \`GROUP_PARTICIPANT_PROMOTE\`: Un usuario es promovido a admin.
- \`GROUP_PARTICIPANT_DEMOTE\`: Un admin es degradado a miembro.
- \`GROUP_CHANGE_SUBJECT\`: El nombre del grupo cambia.

#### \`before: true\`
-   **Propósito:** Permite ejecutar código *antes* de que se procesen los comandos. Es ideal para middleware (anti-spam, baneos, logging, etc.).
-   **Propiedades adicionales:**
    -   \`index: 1 | 2 | 3\`: Define el orden de ejecución.
-   **Orden de Ejecución:**
    -   **\`index: 1\`**: Se ejecuta justo después de crear el objeto \`m\` básico. Aún no hay metadatos del grupo.
    -   **\`index: 2\`**: Se ejecuta después de cargar los metadatos del grupo (si es un grupo) y después de manejar los \`stubtype\`.
    -   **\`index: 3\`**: Se ejecuta justo antes de llamar al script del comando final. Ya tienes \`m.body\`, \`m.command\`, etc.
-   **Control de Flujo:** Puedes detener la ejecución de los siguientes plugins si en tu script de \`before\` haces \`control.end = true;\`.

#### \`export\`
-   **Propósito:** Permite que un plugin comparta funciones o valores con otros plugins.
-   **Cómo usarlo:**
    1.  **En el plugin que exporta:** Añade una propiedad \`export\` al objeto.
        \`\`\`javascript
        // /plugins/utils.js
        export default {
            export: {
                fancyLog: (text) => {
                    console.log(\`✨ [LOG]: \${text} ✨\`);
                }
            }
        };
        \`\`\`
    2.  **En el plugin que importa:** Usa \`plugin.import('nombreDelArchivo')\` dentro de tu \`script\`. El nombre es el del archivo sin la extensión.
        \`\`\`javascript
        // /plugins/mi-comando.js
        export default {
            command: true, usePrefix: true, case: 'log',
            script: async (m, { plugin }) => {
                const utils = plugin.import('utils'); // Importa desde utils.js
                if (utils) {
                    utils.fancyLog('Este es un mensaje desde mi-comando.js');
                    m.reply('Log enviado a la consola!');
                }
            }
        };
        \`\`\`
---

### 4. EJEMPLOS COMPLETOS

#### Comando simple: !ping
\`\`\`javascript
// /plugins/ping.js
export default {
    command: true,
    usePrefix: true,
    case: 'ping',
    script: async (m) => {
        await m.react('✔️');
        await m.reply('Pong!');
    }
};
\`\`\`

#### Comando con argumentos: !say
\`\`\`javascript
// /plugins/say.js
export default {
    command: true,
    usePrefix: true,
    case: 'say',
    script: async (m) => {
        if (!m.text) {
            return m.reply('Por favor, escribe algo para que lo repita. Ejemplo: !say Hola mundo');
        }
        await m.reply(m.text);
    }
};
\`\`\`

#### Comando de administrador: !kick
\`\`\`javascript
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
        
        // Obtener el usuario a expulsar (de una mención o de un reply)
        const userToKick = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || m.quoted?.sender.id;
        
        if (!userToKick) {
            return m.reply('Debes mencionar a alguien o responder a su mensaje para expulsarlo.');
        }

        try {
            await m.chat.remove(userToKick);
            await m.reply(\`✅ Usuario expulsado.\`);
        } catch (e) {
            await m.reply(\`❌ No se pudo expulsar al usuario.\`);
            console.error(e);
        }
    }
};
\`\`\`

#### Evento de bienvenida (stubtype)
\`\`\`javascript
// /plugins/welcome.js
export default {
    stubtype: true,
    case: 'GROUP_PARTICIPANT_ADD', // Se activa cuando alguien entra
    script: async (m, { sock, parameters }) => {
        const userJid = parameters[0]; // El JID del nuevo miembro
        const userName = (await sock['user:data'](userJid)).name || 'Usuario Nuevo';
        const groupName = m.chat.name;
        const welcomeText = \`¡Bienvenid@ @\${userJid.split('@')[0]} al grupo \${groupName}! 🎉\`;
        
        // Enviar al grupo, mencionando al nuevo usuario
        await sock.sendMessage(m.chat.id, { 
            text: welcomeText,
            mentions: [userJid]
        });
    }
};
\`\`\`

#### Middleware de registro (before)
\`\`\`javascript
// /plugins/logger-before.js
import chalk from 'chalk';

export default {
    before: true,
    index: 3, // Se ejecuta justo antes del comando
    script: async (m, { control }) => {
        if (m.isCmd) {
            console.log(
                chalk.yellow('[CMD]'),
                chalk.cyan(m.command),
                'por',
                chalk.green(m.sender.name),
                'en',
                m.chat.group ? chalk.magenta(m.chat.name) : chalk.blue('privado')
            );
        }
        
        // No detenemos el flujo, así que no usamos control.end
    }
};
\`\`\`
`;

        // Para usarlo, simplemente imprime o guarda el contenido de la constante en un archivo.
        // Por ejemplo, en Node.js:
        // import fs from 'fs';
        // fs.writeFileSync('TUTORIAL.txt', TUTORIAL_TEXT);

        // console.log(TUTORIAL_TEXT);

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