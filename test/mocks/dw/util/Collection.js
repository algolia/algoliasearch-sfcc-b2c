const Collection = function(values) {
    this.values = values;
    const that = this;

    this.iterator = function() {
        let nextIndex = 0;

        return {
            hasNext() {
                return nextIndex < that.values.length;
            },
            next() {
                if (nextIndex < that.values.length) {
                    return that.values[nextIndex++];
                }
            },
        };
    }
}

module.exports = Collection;
