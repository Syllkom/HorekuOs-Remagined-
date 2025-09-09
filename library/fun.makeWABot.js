// folder: library

import {
    Browsers,
    makeCacheableSignalKeyStore,
    useMultiFileAuthState
} from '@whiskeysockets/baileys';
import node_cache from 'node-cache';
import $process from './fun.p.Process.js';
import pino from 'pino';

const { default: makeWASocket, proto } = (await import('@whiskeysockets/baileys')).default;

export async function MakeBot(conn = {
    connectType: 'qr-code',
    phoneNumber: ''
}, store) {
    const _path = $process.env.path
    let AuthState = await useMultiFileAuthState(_path.creds)
    const { state, saveCreds } = AuthState

    const connection = {
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),
        emitOwnEvents: true,
        fireInitQueries: true,
        syncFullHistory: true,
        connectTimeoutMs: 60000,
        retryRequestDelayMs: 100,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 5000,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
        appStateMacVerification: {
            patch: true,
            snapshot: true
        },
        transactionOpts: {
            maxCommitRetries: 5,
            delayBetweenTriesMs: 100
        },
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys,
                pino({ level: "fatal" }).child({ level: "fatal" }))
        },
        getMessage: async key => {
            const _store = await store.loadMessage(key.remoteJid, key.id)
            return _store ? _store : { conversation: null };
        }
    }

    if ($process.env.data.subBot) {
        connection.syncFullHistory = false;
        connection.fireInitQueries = false;
        connection.getMessage = async key => null;
    }

    if (conn.connectType == 'qr-code') {
        connection.browser = Browsers.macOS('Desktop')
    }

    const sock = await makeWASocket(connection);
    sock['node-cache'] = new node_cache()
    sock.ev.on('creds.update', saveCreds);

    store?.bind(sock.ev)

    if (conn.connectType == 'pin-code') {
        let numero = conn.phoneNumber.replace(/\D/g, '')
        await new Promise(resolve => setTimeout(resolve, 3000));
        const pairingCode = await sock.requestPairingCode(numero);
        return {
            PairingCode: pairingCode,
            state, store, ...sock, proto
        }
    } else {
        return { ...sock, state, store, proto }
    }
}