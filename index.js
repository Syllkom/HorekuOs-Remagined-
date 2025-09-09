// folder: ./

import path from "path";
import chalk from "chalk";

// libreria
import runQuestion from './library/run.question.js';
import { ForkManager } from './library/fun.p.makeFork.js';

let _runQuestion = await runQuestion()
const modulePath = path.resolve('./source/index.js')

async function startMain() {
    const mainBot = new ForkManager(modulePath, {
        execArgv: ['--max-old-space-size=512'],
        cwd: path.dirname('./'),
        serialization: 'json',
        // silent: true,
        env: {
            dataConfig: { subBot: false, },
            connOptions: { ..._runQuestion }
        }
    })

    mainBot.event.set('message', async (m) => {
        let message = m.content || {}
        let data = message.data || {}
        let sender = m.sender || {}

        // event
        switch (message.event) {
            case 'pairing:qr-code': {
                console.log(chalk.rgb(16, 61, 207)('qr code:'));
                console.log(data.qrCodeText);
            } break;

            case 'pairing:pin-code': {
                console.log(chalk.rgb(16, 61, 207)('qr code:'));
                console.log(data.formattedCode);
            } break;
        }

        // type
        switch (message.type) {
            case 'connection:open': {
                console.log(chalk.rgb(70, 209, 70)
                    ('Connection open:'), {
                    sender, data: message.data
                });
            } break;

            case 'connection:close': {
                console.log(chalk.rgb(201, 54, 54)
                    ('Connection open:'), {
                    sender, data: message.data
                });
            } break;

            case 'console:log': {
                console.log('main:Bot', ...data)

            } break;
        }
    });

    mainBot.event.set('exit', async ({ code, signal }) => {
        console.log({ code, signal });
        await new Promise(resolve =>
            setTimeout(resolve, 2000));
        await mainBot.start();
    });

    mainBot.event.set('error', (e) => {
        console.error(`Error:`, e)
    });

    await mainBot.start()
}

await startMain()