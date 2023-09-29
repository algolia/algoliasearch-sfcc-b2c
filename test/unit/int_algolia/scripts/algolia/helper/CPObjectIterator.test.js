const CPObjectIterator = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/CPObjectIterator');

describe('CPObjectIterator', () => {
    test('should return null if the structure is empty', () => {
        const iterator = new CPObjectIterator([]);
        expect(iterator.next()).toBeNull();
    });

    test('should return null if the first element is an empty object', () => {
        const iterator = new CPObjectIterator([{}]);
        expect(iterator.next()).toBeNull();
    });

    test('should iterate over all elements in the structure', () => {
        const changedProducts = [
            { 'productID1': true, 'productID2': false },
            { 'productID3': true, 'productID4': false },
            { 'productID5': true, 'productID6': false },
        ];
        const iterator = new CPObjectIterator(changedProducts);
        expect(iterator.next()).toEqual({ productID: 'productID1', available: true });
        expect(iterator.next()).toEqual({ productID: 'productID2', available: false });
        expect(iterator.next()).toEqual({ productID: 'productID3', available: true });
        expect(iterator.next()).toEqual({ productID: 'productID4', available: false });
        expect(iterator.next()).toEqual({ productID: 'productID5', available: true });
        expect(iterator.next()).toEqual({ productID: 'productID6', available: false });
        expect(iterator.next()).toBeNull();
    });

    test('should handle a structure with only one element', () => {
        const changedProducts = [{ 'productID1': true }];
        const iterator = new CPObjectIterator(changedProducts);
        expect(iterator.next()).toEqual({ productID: 'productID1', available: true });
        expect(iterator.next()).toBeNull();
    });

    test('should handle a structure with only one object', () => {
        const changedProducts = [{ 'productID1': true, 'productID2': false }];
        const iterator = new CPObjectIterator(changedProducts);
        expect(iterator.next()).toEqual({ productID: 'productID1', available: true });
        expect(iterator.next()).toEqual({ productID: 'productID2', available: false });
        expect(iterator.next()).toBeNull();
    });
});

