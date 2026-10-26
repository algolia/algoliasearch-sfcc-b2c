const fs = require('fs');
const path = require('path');
const util = require('util');

const envFilePath = path.resolve(__dirname, '../.env');

// CI passes the variables through the environment and has no .env file.
// Variables that are already set take precedence over the ones in the file.
// process.loadEnvFile() is not used because Jest gives each test file its own copy of
// process.env, and the variables it sets are not visible in that copy.
if (fs.existsSync(envFilePath)) {
    const fileVariables = util.parseEnv(fs.readFileSync(envFilePath, 'utf8'));
    Object.keys(fileVariables).forEach((variableName) => {
        if (process.env[variableName] === undefined) {
            process.env[variableName] = fileVariables[variableName];
        }
    });
}
