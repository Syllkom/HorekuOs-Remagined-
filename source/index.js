// folder: source

import fs from 'fs';
import path from 'path';

import './global.js';
import $process from '../library/fun.p.Process.js';
import chalk from 'chalk';
chalk.level = 2

Object.assign($process.env, {
    data: $process.env.dataConfig || {},
    options: $process.env.connOptions || {},
    subBot: $process.env.dataConfig.subBot,
})

const { data } = $process.env;
const basePath = path.join(data.subBot
    ? `./source/nodos/${data.slot}` : `./source/storage`);
fs.mkdirSync(basePath, { recursive: true });
for (const folder of ['creds', 'store', 'tmp']) {
    fs.mkdirSync(path.join(basePath, folder),
        { recursive: true });
}

const folder = !data.subBot ? path.resolve(`./source/storage`)
    : path.resolve(`./source/nodos/${data.slot}`)

Object.assign($process.env, {
    path: {
        plugins: path.resolve('./plugins'),
        creds: path.join(folder, "creds"),
        store: path.join(folder, "store"),
        tmp: path.join(folder, "tmp"),
    }
})

await import('./main.js');