// folder: library

import { createInterface } from 'readline/promises';
import fs from "fs";

const creds = fs.existsSync(`./source/storage/creds/creds.json`);

const readline = createInterface({
    input: process.stdin,
    output: process.stdout
});

export const question = async (text) =>
    await new Promise(async resolve =>
        resolve(await readline.question(text)));

export default async () => {
    let connection = null
    if (!connection && !creds) {
        while (true) {
            if (!connection && !creds) {
                let text = ''
                text += '\n\x1b[1;31m╭╼◯\x1b[1;37m \x1b[1;32m HorekuOs / Comnect\x1b[0m\n'
                text += '\x1b[1;31m╷\x1b[1;37m Como desea conectarse:\n'
                text += '\x1b[1;31m├╶╶╶✦\x1b[1;37m\n'
                text += '\x1b[1;31m╵⌬\x1b[1;37m \x1b[1;32m1. Por QR\x1b[0m\n'
                text += '\x1b[1;31m╵⌬\x1b[1;37m \x1b[1;32m2. Código por 8 dígitos\x1b[0m\n'
                text += '\x1b[1;31m╰────────────────────────────◯\x1b[1;37m\n\n'
                text += '\x1b[1;31m●\x1b[1;37m Escriba "exit" para cancelar.\n'
                text += '\x1b[1;31m~\x1b[1;37m> '

                const opcion = (await question(text)).trim();

                if (opcion === 'exit') break;

                if (opcion === '1') {
                    readline.close();
                    return {
                        connectType: 'qr-code',
                        phoneNumber: ''
                    };
                }

                if (opcion === '2') {
                    while (true) {
                        let text = ''
                        text += '\n\x1b[1;31m●\x1b[1;37m '
                        text += '¿Cuál es el número que desea asignar como Bot?\n'
                        text += '(Escriba "back" para volver)\n'
                        text += '\x1b[1;31m●\x1b[1;37m '
                        let numero = await question(text);
                        numero = numero.trim();


                        if (numero.toLowerCase() === 'back') break;
                        if (!numero) {
                            console.log('\x1b[1;33mEl número es obligatorio. Por favor ingrese un número válido.\x1b[0m');
                            continue;
                        }

                        readline.close();
                        return {
                            connectType: 'pin-code',
                            phoneNumber: numero
                        };
                    }
                } else {
                    console.log('\x1b[1;33mOpción no válida. Intente de nuevo.\x1b[0m');
                }
            }
        }
        readline.close();
        return {
            connectType: 'qr-code',
            phoneNumber: ''
        };
    }
}