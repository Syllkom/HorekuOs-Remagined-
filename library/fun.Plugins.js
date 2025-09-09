// folder: library

import path from "path";
import logger from "./fun.p.logger.js"
import { pathToFileURL } from 'url';
import { watch } from 'chokidar';
import fs from 'fs/promises';
import lodash from 'lodash'

export class Plugins {
    constructor(folderPath, defaultObjects = {}) {
        this['@export'] = new Map();
        this['@plugins'] = new Map();
        this['@folderPath'] = folderPath;
        this['@Objects'] = defaultObjects

        watch(folderPath, {
            persistent: true
        }).on('add', (file) => {
            file = path.basename(file);
            this.set(file)
        }).on('change', (file) => {
            file = path.basename(file);
            if (this['@plugins'].has(file))
                this['@plugins'].delete(file)
            setTimeout(() => this.set(file), 1000);
        }).on('unlink', (file) => {
            file = path.basename(file);
            if (this['@plugins'].has(file))
                this['@plugins'].delete(file);
        }).on('error', e => logger.error(e));
    }

    has(any) { return this['@plugins'].has(any) }
    delete(any) { return this['@plugins'].delete(any) }
    import(any) { return this['@export'].get(any) }
    export(any, object) {
        if (!this['@export'].has(any)) {
            this['@export'].set(any, object)
        } else {
            const existing = this['@export'].get(any);
            Object.assign(existing, object)
        }
        return this['@export'].get(any);
    }

    async load() {
        const files = await fs.readdir(this['@folderPath'])
        for (const file of files) { await this.set(file) }
    }

    async set(any) {
        if (!any.endsWith('.js')) return;
        const filePath = `${this['@folderPath']}/${any}`
        const fileURL = pathToFileURL(filePath);
        await import(`${fileURL.href}?update=${Date.now()}`)
            .then((mod) => {
                const module = mod.default || mod;
                if (typeof module.export === 'object')
                    Object.entries(module.export)
                        .forEach(([key, value]) => {
                            this["@export"].set(key, value);
                        });
                this['@plugins'].set(any, {
                    ...this['@Objects'],
                    fileName: any,
                    ...module
                });
            }).catch(e => logger.error(e));
    }

    async get(any) {
        if (typeof any === 'string') return this['@plugins'].get(any);
        if (typeof any !== 'object' || any === null) return [];
        return Array.from(this['@plugins'].values()).filter(plugin =>
            Object.entries(any).every(([key, value]) => {
                if (typeof value === 'string' && Array.isArray(plugin[key]))
                    return plugin[key].includes(value);
                if (Array.isArray(value) && typeof plugin[key] === 'string')
                    return value.includes(plugin[key]);
                if (Array.isArray(value) && Array.isArray(plugin[key]))
                    return value.some(v => plugin[key].includes(v));
                return lodash.isEqual(value, plugin[key]);
            })
        );
    }
}