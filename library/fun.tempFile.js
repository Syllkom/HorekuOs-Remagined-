// folder: library

import path from 'path'
import fs from 'fs/promises'
import logger from './fun.p.logger.js';
import $process from './fun.p.Process.js';

export function tmpClear() {
    const _path = $process.env.path
    return setInterval(async () => {
        try {
            for (const file of await fs.readdir(_path.tmp)) {
                try {
                    await fs.unlink(path.join(_path.tmp, file))
                } catch (e) { logger.error(e) }
            }
        } catch (e) { logger.error(e) }
    }, 1000 * 60)
}