const productModelCustomizer = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/customization/productModelCustomizer');

describe('customizeLocalizedProductModel (jobs v2)', () => {
    let product;
    beforeEach(() => {
        product = {
            categories: [
                [
                    { id: 'electronics-televisions', name: 'Televisions' },
                    { id: 'electronics', name: 'Electronics' },
                ],
                [
                    { id: 'newarrivals-electronics', name: 'Electronics' },
                    { id: 'newarrivals', name: 'New Arrivals' },
                ],
            ],
        };
    });

    test('newArrivalsCategory in the additional attributes list', () => {
        productModelCustomizer.customizeLocalizedProductModel(product, ['newArrivalsCategory']);
        expect(product).toHaveProperty('newArrivalsCategory');
        expect(product.newArrivalsCategory).toEqual({
            0: 'New Arrivals',
            1: 'New Arrivals > Electronics',
        });
    });

    test('newArrivalsCategory not in the additional attributes list', () => {
        productModelCustomizer.customizeLocalizedProductModel(product, []);
        expect(product).not.toHaveProperty('newArrivalsCategory');
    });

    test('newArrival', () => {
        productModelCustomizer.customizeLocalizedProductModel(product, ['newArrival']);
        expect(product).toHaveProperty('newArrival');
        expect(product.newArrival).toBe(true);
    });
});
