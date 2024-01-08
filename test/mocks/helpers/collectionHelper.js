function createCollection(array) {
    array.size = function() {
        return array.length;
    };
    array.iterator = function() {
        let nextIndex = 0;

        return {
            hasNext() {
                return nextIndex < array.length;
            },
            next() {
                if (nextIndex < array.length) {
                    return array[nextIndex++];
                }
            },
        };
    };
    return array;
}

module.exports = {
    createCollection: createCollection,
}
