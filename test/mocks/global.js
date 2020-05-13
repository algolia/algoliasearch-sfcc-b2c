/**
* Check object is empty
* @param {Object} obj object
* @returns {boolean} true if object is empty 
*/
function empty(obj) {
    return (obj === null || obj === undefined || obj === '' || (typeof(obj) !== 'function' && obj.length !== undefined && obj.length === 0));
}

var session = {
    sessionID : 'session_ID_00001',
    privacy   : {
        sift_cardInfo: null
    }
};

var request = {
    httpUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36'
};

module.exports = {
    empty   : empty,
    session : session,
    request : request
}
