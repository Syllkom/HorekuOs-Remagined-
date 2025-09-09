// folder: library

import Jimp from 'jimp';
import logger from './fun.p.logger.js';
import { PassThrough, Readable } from 'stream'
import { TmpStore } from './utils.js';
import lodash from 'lodash';
import path from 'path';
import got from 'got';
import fs from 'fs';

import {
    downloadContentFromMessage,
    generateWAMessageContent,
    generateWAMessageFromContent,
    downloadMediaMessage,
} from '@whiskeysockets/baileys';

import $base from '../library/fun.makeDBase.js';

const tmpStore = new TmpStore()

export default async function (sock) {
    try {
        sock.Baileys = async () => {
            return (await import('@whiskeysockets/baileys')).default
        }

        sock.getFrom = async (source, type = 'buffer') => {
            const toStream = (buffer) => {
                const stream = new PassThrough();
                stream.end(buffer);
                return stream;
            };

            const streamToBuffer = async (stream) => {
                const chunks = [];
                for await (const chunk of stream)
                    chunks.push(chunk);
                return Buffer.concat(chunks);
            };

            try {
                let data = null;
                if (Buffer.isBuffer(source)) {
                    data = source;
                } else if (source instanceof Readable) {
                    data = await streamToBuffer(source);
                } else if (typeof source === 'string') {
                    if (/^data:.*;base64,/i.test(source)) {
                        const base64 = source.split(',')[1];
                        data = Buffer.from(base64, 'base64');
                    } else if (/^https?:\/\//i.test(source)) {
                        data = (await got(source, {
                            responseType: 'buffer',
                            headers: {
                                'User-Agent': 'Mozilla/5.0',
                                'Connection': 'keep-alive',
                                'Range': 'bytes=0-',
                                'Accept': '*/*',
                            },
                        })).body;
                    } else if (fs.existsSync(source)) {
                        data = fs.readFileSync(path.resolve(source));
                    }
                }

                if (!data || !Buffer.isBuffer(data)) {
                    console.error('Invalid data type');
                    return null;
                }

                if (type === 'base64') return data.toString('base64');
                if (type === 'stream') return toStream(data);
                return data;

            } catch (e) {
                console.error('[ERROR]:', e.message);
                return null;
            }
        };

        sock.getJSON = async (url) => {
            if (!url) throw new Error('sock.getJSON:0');
            try {
                return (await got(url, { responseType: 'json', timeout: { request: 10000 }, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36' }, retry: { limit: 2 } })).body;
            } catch (error) {
                console.error(`sock.getJSON:${url}:`, error.message);
                return 0
            }
        }

        sock.uploadFiloTmp = async (file) => {
            try {
                const form = new FormData()
                file = Buffer.isBuffer(file) ? file : (await got(file, { responseType: 'buffer' })).body
                form.append('file', file, { filename: 'image.jpg' })
                const tmp = await got.post('https://tmpfiles.org/api/v1/upload', { body: form, headers: { ...form.getHeaders() } })
                return (JSON.parse(tmp.body).data.url).replace('tmpfiles.org/', 'tmpfiles.org/dl/')
            } catch (e) {
                logger.error(e)
            }
        }

        sock.downloadMedia = async (message, type = 'buffer') => {
            if (typeof message !== 'object')
                return new Error('not a message object');
            if (!message || !message.key || !message.key.id)
                throw new Error('not a valid message object');
            return await downloadMediaMessage(message, type, {
                reuploadRequest: sock.updateMediaMessage
            })
        }

        sock.downloadMediaMessage = async (message) => {
            const mime = message.mimetype || "";
            let messageType = mime.split("/")[0];
            const stream = await downloadContentFromMessage(message, messageType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
            return buffer;
        }

        sock.sendWAMContent = async (jid, message, options = {}) => {
            const gmessage = generateWAMessageFromContent(jid, message, options)
            await sock.relayMessage(jid, gmessage.message, {})
            return gmessage
        }

        sock.saveMessageIdForResponse = async (message, options = {}) => {
            const db = await $base.open('system:SMIFR')
            if (!db.data[message.key.id]) db.data[message.key.id] =
                (((o) => JSON.parse(JSON.stringify(o, (key, value) =>
                    typeof value === 'function' ? value.toString()
                        : value)))(options))
            await db.update()
        };

        //name: 'single_select'
        //name: 'cta_reminder'
        //name: 'cta_url'
        //name: 'cta_copy'
        //name: 'quick_reply'

        sock.sendButton = async (jid, object, options = {}) => {
            const _mediaType = ['document', 'video', 'image']
            let mediaMessage, resultMessage, mediaType
            if (_mediaType.some(o => object[o])) {
                for (const key of _mediaType) {
                    if (object[key]) {
                        const newObject = lodash.cloneDeep(object)
                        if (newObject.body) delete newObject.body
                        if (newObject.title) delete newObject.title
                        if (newObject.footer) delete newObject.footer
                        if (newObject.buttons) delete newObject.buttons
                        mediaMessage = await generateWAMessageContent(newObject,
                            { upload: sock.waUploadToServer });
                        mediaType = Object.keys(mediaMessage)[0];
                        resultMessage = mediaMessage[mediaType]
                    }
                }
            }

            return await sock.sendWAMContent(jid, {
                viewOnceMessage: { message: { "messageContextInfo": { "deviceListMetadata": {}, "deviceListMetadataVersion": 2 }, interactiveMessage: { header: resultMessage ? { title: object.title || '', hasMediaAttachment: false, [mediaType]: resultMessage } : { title: object.title || '', hasMediaAttachment: false }, body: { text: object.body || '' }, footer: { text: object.footer || '' }, contextInfo: object.contextInfo || {}, nativeFlowMessage: { buttons: object.buttons || {}, messageParamsJson: '' } } } }
            }, options)
        }

        sock.resizePhoto = async (data = { image: '', scale: 720, result: 'buffer' }) => {
            if (!data.image) return new Error('sock.resizePhoto( image ? )')
            if (!data.result) data.result = 'buffer'
            if (!data.scale) data.scale = 720
            if (data.image.startsWith('https://'))
                data.image = await sock.getFrom(data.image)
            const jimp = await Jimp.read(data.image);
            const cropped = jimp.crop(0, 0, jimp.getWidth(), jimp.getHeight());
            const scaledImage = cropped.scaleToFit(data.scale, data.scale);
            return data.result === 'base64' ?
                (await scaledImage.getBase64Async(Jimp.MIME_JPEG))
                    .replace(/^data:image\/\w+;base64,/, '')
                : await scaledImage.getBufferAsync(Jimp.MIME_JPEG);
        }

        //getChatData
        sock['chat:data'] = async (chat, message) => {
            if (!chat) return new Error('sock.getChatData( chat ? )')

            const groupMetadata = async (m) => {
                if (!m.group) return {}
                if (tmpStore.has(`${m.id}-metadata`))
                    return tmpStore.get(`${m.id}-metadata`)
                let metadata = await sock.groupMetadata(m.id).catch(e => ({}))
                tmpStore.set(`${m.id}-metadata`, metadata)
                return metadata
            }

            const profilePicture = async (m, type, id) => {
                if (tmpStore.has(`${m.id}-profilephoto`))
                    return tmpStore.get(`${m.id}-profilephoto`)
                const photo = await sock.profilePictureUrl(id, type)
                    .catch(_ => 'https://objetivoligar.com/wp-content/uploads/2017/03/blank-profile-picture-973460_1280-768x768.jpg')
                tmpStore.set(`${m.id}-profilephoto`, photo)
            }

            let m = { id: chat }
            m.group = m.id.endsWith('@g.us')
            m.metaData = await groupMetadata(m)
            m.name = m.metaData.subject || 'undefined'
            m.description = m.metaData.desc || 'undefined'
            m.participants = m.metaData.participants || []
            m.admins = m.participants.filter(o =>
                ['admin', 'superadmin'].some(_ => _ === o.admin)).map(v => v.id) || []
            m.owner = m.metaData.owner || m.metaData.subjectOwner || 'undefined'
            m.photo = async (type = 'image', id = m.id) => await profilePicture(m, type, id)
            if (m.admins.includes(`${sock.user.id.split(":")[0]}@s.whatsapp.net`)) {
                m.promote = async (user) => await sock.groupParticipantsUpdate(m.id, [user], 'promote')
                m.demote = async (user) => await sock.groupParticipantsUpdate(m.id, [user], 'demote')
                m.change = {
                    description: async (text) => await sock.groupUpdateDescription(m.id, text),
                    name: async (text) => await sock.groupUpdateSubject(m.id, text),
                    photo: async (image, type = 'normal') => type == 'normal' ? await sock.updateProfilePicture(m.id, image) : await sock.query({ tag: 'iq', attrs: { target: m.id, to: '@s.whatsapp.net', type: 'set', xmlns: 'w:profile:picture' }, content: [{ tag: 'picture', attrs: { type: 'image' }, content: await sock.resizePhoto({ image: image, scale: 720, result: 'buffer' }) }] })
                }
                m.InviteCode = async () => await sock.groupInviteCode(m.id)
                m.InviteLink = async () => `https://chat.whatsapp.com/${await m.InviteCode()}`
            }
            return m
        }

        //getUserData
        sock['user:data'] = async (user, message) => {
            if (!user) return new Error('sock.getUserData( user ? )')

            const profilePicture = async (m, type, id) => {
                if (tmpStore.has(`${m.id}-profilephoto`))
                    return tmpStore.get(`${m.id}-profilephoto`)
                const photo = await sock.profilePictureUrl(id, type)
                    .catch(_ => 'https://objetivoligar.com/wp-content/uploads/2017/03/blank-profile-picture-973460_1280-768x768.jpg')
                tmpStore.set(`${m.id}-profilephoto`, photo)
            }

            let m = { id: user }
            m.number = m.id.split('@')[0] || undefined
            m.bot = (sock.user.id.split(":")[0] + "@s.whatsapp.net") == m.id
            m.photo = async (type = 'image', id = m.id) => await profilePicture(m, type, id)
            m.description = async () => (await sock.fetchStatus(m.id) || {})?.status || 'undefined'
            m.waLink = `https://wa.me/${m.number}`
            if (m.bot) {
                m.subBot = sock.subBot
                m.change = {
                    description: async (text) => await sock.updateProfileStatus(text),
                    name: async (text) => await sock.updateProfileName(text),
                    photo: async (image, type = 'normal') => type == 'normal' ? await sock.updateProfilePicture(m.id, image) : await sock.query({ tag: 'iq', attrs: { to: '@s.whatsapp.net', type: 'set', xmlns: 'w:profile:picture' }, content: [{ tag: 'picture', attrs: { type: 'image' }, content: await sock.resizePhoto({ image: image, scale: 720, result: 'buffer' }) }] })
                }
            }
            return m
        }

    } catch (e) { logger.error(e) }
    return sock
}