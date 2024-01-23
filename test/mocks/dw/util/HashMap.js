var HashMap = function(size) {
    this.size = size || 100;
    this.buckets = new Array(this.size);
    for (var i = 0; i < this.buckets.length; i++) {
        this.buckets[i] = new Map(); // Using a Map for each bucket to handle collisions
    }
};

HashMap.prototype.hash = function(key) {
    var hash = 0;
    for (var i = 0; i < key.length; i++) {
        hash += key.charCodeAt(i);
    }
    return hash % this.size;
};

HashMap.prototype.put = function(key, value) {
    var index = this.hash(key);
    this.buckets[index].set(key, value);
};

HashMap.prototype.get = function(key) {
    var index = this.hash(key);
    return this.buckets[index].get(key);
};

HashMap.prototype.remove = function(key) {
    var index = this.hash(key);
    this.buckets[index].delete(key);
};

module.exports = HashMap;
