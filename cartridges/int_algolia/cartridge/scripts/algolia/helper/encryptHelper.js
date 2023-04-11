'use strict';

/**
 * Encrypt OCAPI client ID and password
 * @param {string} clientId - client ID
 * @param {string} clientPassword - password
 * @param {string} key - encrypt key
 * @param {string} initSalt - inintialization vector
 * @returns {Object} - encrypted client ID and password
 */
function encryptOcapiCredentials(clientId, clientPassword, key, initSalt) {
    var Encoding = require('dw/crypto/Encoding');
    var Cipher = require('dw/crypto/Cipher');
    var Bytes = require('dw/util/Bytes');

    if (empty(clientId) || empty(clientPassword) || empty(key) || empty(initSalt)) {
        return null;
    }

    var salt = initSalt;
    while (salt.length < 16) {
        salt += initSalt;
    }
    salt = salt.slice(0, 16);

    var encryptAlgorithm = 'AES/CBC/PKCS5Padding';
    var cipher = new Cipher();
    var encodedKey = Encoding.toBase64(new Bytes(key, 'UTF8'));
    var encodedSalt = Encoding.toBase64(new Bytes(salt, 'UTF8'));
    var encryptClientId = cipher.encrypt(clientId, encodedKey, encryptAlgorithm, encodedSalt, 1);
    var encryptClientPassword = cipher.encrypt(clientPassword, encodedKey, encryptAlgorithm, encodedSalt, 1);
    return {
        clientId: encryptClientId,
        clientPassword: encryptClientPassword
    };
}

module.exports = {
    encryptOcapiCredentials: encryptOcapiCredentials
};
