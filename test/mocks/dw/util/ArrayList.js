class ArrayList {
    constructor(arr) {
        this.arr = arr || [];
    }

    toArray() {
        return this.arr;
    }
    size() {
        return this.arr.length;
    }
    get(i) {
        return this.arr[i];
    }
}
module.exports = ArrayList;
