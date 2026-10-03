import {readFile, writeFile, readdir, realpath, access} from 'node:fs/promises';
import {resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSectionStyles} from './component-style.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sections = resolve(root, 'section');
const valid = /^[A-Za-z0-9_-]+$/;

async function syncScripts() {
    const path = resolve(root, 'package.json');
    const pkg = JSON.parse(await readFile(path, 'utf8'));
    pkg.scripts['section:build'] = 'node tools/build-section-css.mjs';
    pkg.scripts['section:scripts'] = 'node tools/build-section-css.mjs --sync';
    // Replace only aliases owned by this tool, leaving all other npm scripts intact.
    for (const [name, command] of Object.entries(pkg.scripts)) {
        if (/^section:[^:]+:[^:]+$/.test(name) && command.startsWith('node tools/build-section-css.mjs ')) delete pkg.scripts[name];
    }
    let count = 0;
    for (const type of (await readdir(sections, {withFileTypes: true})).sort((a,b) => a.name.localeCompare(b.name))) {
        if (!type.isDirectory() || !valid.test(type.name)) continue;
        for (const salt of (await readdir(resolve(sections, type.name), {withFileTypes: true})).sort((a,b) => a.name.localeCompare(b.name))) {
            if (!salt.isDirectory() || !valid.test(salt.name)) continue;
            try { await access(resolve(sections, type.name, salt.name, 'section.scss')); } catch { continue; }
            const name = `section:${type.name}:${salt.name}`;
            if (pkg.scripts[name]) throw new Error(`Existing script conflicts: ${name}`);
            pkg.scripts[name] = `node tools/build-section-css.mjs ${type.name}/${salt.name}`;
            count++;
        }
    }
    await writeFile(path, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`Registered ${count} section CSS commands`);
}

async function compile(key) {
    if (!key || !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(key)) {
        throw new Error('Usage: npm run section:build -- type/salt');
    }
    const directory = await realpath(resolve(sections, key));
    if (!directory.startsWith((await realpath(sections)) + sep)) throw new Error('Component must be inside section/');
    const input = resolve(directory, 'section.scss');
    const {demo, production} = await buildSectionStyles(input);
    console.log(`section/${key}/section.css: ${Buffer.byteLength(demo)} bytes (demo)`);
    console.log(`section/${key}/section.min.css: ${Buffer.byteLength(production)} bytes (production)`);
}

try {
    if (process.argv[2] === '--sync') await syncScripts();
    else await compile(process.argv[2]);
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
