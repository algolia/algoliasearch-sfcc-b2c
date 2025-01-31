#!/usr/bin/env node
/**
 * prepareCode.js
 * --------------
 * Creates a code version directory, copies cartridges, and zips them up
 * under <CODE_VERSION>.zip
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

(function main() {
    const codeVersion = process.env.CODE_VERSION;
    if (!codeVersion) {
        console.error('ERROR: CODE_VERSION is not set. Please define it in your .env or environment.');
        process.exit(1);
    }

    console.log(`Preparing code with CODE_VERSION: ${codeVersion}`);

    // Ensure the codeVersion directory does not already exist
    if (!fs.existsSync(codeVersion)) {
        fs.mkdirSync(codeVersion);
    }

    // Copy cartridges folder into the code version folder
    // On Unix-based systems, you could also do a cp -R, but let's do it via Node for clarity:
    // If you're on Node 16+, you can use fs.cp, else use fallback:
    copyDirectoryRecursive('cartridges', codeVersion);

    // Zip up the directory
    const zipFileName = `${codeVersion}.zip`;
    console.log(`Zipping ${codeVersion} into ${zipFileName}...`);
    zipDirectory(codeVersion, zipFileName);

    console.log('Code preparation completed.');
})();

/**
 * Recursively copies the contents of srcDir into destDir.
 */
function copyDirectoryRecursive(srcDir, destDir) {
    if (!fs.existsSync(srcDir)) {
        throw new Error(`Source directory does not exist: ${srcDir}`);
    }
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    entries.forEach(entry => {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyDirectoryRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    });
}

/**
 * Creates a zip archive of the given directory as outputFile.
 */
function zipDirectory(directory, outputFile) {
    const output = fs.createWriteStream(outputFile);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
        output.on('close', () => {
            console.log(`Created ${outputFile} (${archive.pointer()} total bytes).`);
            resolve();
        });
        archive.on('error', (err) => reject(err));

        archive.pipe(output);
        archive.directory(directory, false); // no extra folder in zip
        archive.finalize();
    });
}
