/**
 * Creates a code version directory, copies cartridges, and zips them up
 * under <CODE_VERSION>.zip
 */

require('dotenv').config();
const fs = require('fs');
const archiver = require('archiver');

(function main() {
    const codeVersion = process.env.CODE_VERSION;
    if (!codeVersion) {
        console.error('ERROR: CODE_VERSION is not set. Please define it in your .env or environment.');
        process.exit(1);
    }

    console.log(`Preparing code with CODE_VERSION: ${codeVersion}`);

    // Copy the contents of the "cartridges" folder directly into the codeVersion directory
    var srcDir = 'cartridges';
    if (!fs.existsSync(srcDir)) {
        throw new Error('Source directory does not exist: ' + srcDir);
    }

    // Copy the contents of the "cartridges" folder directly into the codeVersion directory
    fs.cpSync(srcDir, codeVersion, { recursive: true });

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
