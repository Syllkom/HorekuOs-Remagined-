// folder: source

import {
    DisconnectReason,
    // makeInMemoryStore
} from '@whiskeysockets/baileys';
import qrTerminal from 'qrcode-terminal';
import { Boom } from '@hapi/boom';
import qrCode from 'qrcode';
import pino from 'pino';

// from libreria
import logger from '../library/fun.p.logger.js';
import $base from '../library/fun.makeDBase.js';
import { tmpClear } from '../library/fun.tempFile.js';
import { MakeBot } from '../library/fun.makeWABot.js';
import { Plugins } from '../library/fun.Plugins.js';
import $process from '../library/fun.p.Process.js';
import $Sock from '../library/@sock.assign.js';

const objects = {}

try {
    const { data, path: _path } = $process.env
    await $base.Start($process.env.path.store)

    const plugins = new Plugins(_path.plugins, {
        usePrefix: true,
        stubtype: false,
        command: false,
    });


    // tmp
    tmpClear()

    // start
    async function StartBot(params) {
        const sock = await MakeBot(params ??
            $process.env.options, objects.store)

        Object.assign(sock, {
            plugins: plugins,
            ...(await $Sock(sock)),
            '@send': $process.send,
            subBot: data.subBot,
        })

        if (sock.PairingCode) $process.send({
            content: {
                event: 'pairing:pin-code',
                data: {
                    pairingCode: sock.PairingCode,
                    formattedCode: sock.PairingCode
                        .match(/.{1,4}/g)?.join("-") ??
                        sock.PairingCode
                }
            }
        })

        sock.ev.on('connection.update', async (update) => {
            const { lastDisconnect, connection, qr } = update;

            if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode || 500;
                if (reason === DisconnectReason.restartRequired) {
                    await StartBot({
                        ...($process.env.options || {}),
                        connectType: 'qr-code'
                    });
                } else {
                    $process.send({
                        content: {
                            type: 'connection:close',
                            data: {
                                reasonCode: reason,
                                reasonMessage: lastDisconnect
                                    ?.error?.message ??
                                    'Unknown reason'
                            }
                        }
                    });
                    if (reason !== DisconnectReason.loggedOut)
                        await StartBot({
                            ...($process.env.options || {}),
                            connectType: 'qr-code'
                        });
                }
            }

            if (connection === 'open') $process.send({
                content: {
                    type: 'connection:open',
                    data: {
                        ...data,
                        ...sock.user,
                        isConnected: true,
                        id: sock.user.id.split(":")[0]
                            + "@s.whatsapp.net"
                    }
                }
            })

            if (qr) $process.send({
                content: {
                    event: 'pairing:qr-code',
                    data: {
                        rawQrCode: qr,
                        qrCodeImage: await qrCode.toDataURL(qr),
                        qrCodeText: await new Promise((resolve) =>
                            qrTerminal.generate(qr, { small: true },
                                (qrCode) => resolve(qrCode)))
                    }
                }
            })
        })


        sock.ev.on('messages.upsert', async (m) => {
            try {
                const pathFile = `./script.js?update=${Date.now()}`
                const chatUpdate = (await import(pathFile));
                await chatUpdate.default(m, sock)
            } catch (e) {
                logger.error(e);
            }
        })
    }

    await StartBot()
} catch (e) {
    logger.error(e);
    new Error(e)
}