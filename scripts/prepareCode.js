/**
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

    // Copy the contents of the "cartridges" folder directly into the codeVersion directory
    var srcDir = 'cartridges';
    if (!fs.existsSync(srcDir)) {
        throw new Error('Source directory does not exist: ' + srcDir);
    }

    // Copy the contents of the "cartridges" folder directly into the codeVersion directory
    var entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var srcPath = path.join(srcDir, entry.name);
        var destPath = path.join(codeVersion, entry.name);
        // fs.cpSync handles both files and directories when using { recursive: true }.
        fs.cpSync(srcPath, destPath, { recursive: true });
    }

    // Zip up the directory
    const zipFileName = `${codeVersion}.zip`;
    console.log(`Zipping ${codeVersion} into ${zipFileName}...`);
    zipDirectory(codeVersion, zipFileName);

    console.log('Code preparation completed.');
})();

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
