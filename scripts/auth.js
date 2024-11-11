// scripts/auth.js
require('dotenv').config();
const sfcc = require('sfcc-ci');

function authenticate() {
    return new Promise((resolve, reject) => {
        const clientId = process.env.SFCC_OAUTH_CLIENT_ID;
        const clientSecret = process.env.SFCC_OAUTH_CLIENT_SECRET;

        sfcc.auth.auth(clientId, clientSecret, (err, token) => {
            if (err) {
                console.error('Authentication error:', err);
                reject(err);
            } else {
                console.log('Authenticated successfully.');
                resolve(token);
            }
        });
    });
}

module.exports = authenticate;