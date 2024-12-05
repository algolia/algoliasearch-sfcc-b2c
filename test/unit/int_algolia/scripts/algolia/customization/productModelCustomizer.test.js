const productModelCustomizer = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/customization/productModelCustomizer');

describe('customizeProductModel (jobs v1)', () => {
    let product;
    beforeEach(() => {
        product = {
            categories: [
                [
                    {
                        id: 'electronics-televisions',
                        name: { en: 'Televisions', fr: 'Télévisions' },
                    },
                    { id: 'electronics', name: { en: 'Electronics', fr: 'Electronique' } },
                ],
                [
                    {
                        id: 'newarrivals-electronics',
                        name: { en: 'Electronics', fr: 'Electronique' },
                    },
                    { id: 'newarrivals', name: { en: 'New Arrivals', fr: 'Nouveautés' } },
                ],
            ],
        };
    });

    test('newArrivalsCategory in the additional attributes list', () => {
        productModelCustomizer.customizeProductModel(product, ['newArrivalsCategory']);
        expect(product).toHaveProperty('newArrivalsCategory');
        expect(product.newArrivalsCategory).toEqual({
            0: {
                en: 'New Arrivals',
                fr: 'Nouveautés',
            },
            1: {
                en: 'New Arrivals > Electronics',
                fr: 'Nouveautés > Electronique',
            },
        });
    });

    test('newArrivalsCategory not in the additional attributes list', () => {
        productModelCustomizer.customizeProductModel(product, []);
        // Property is present, but won't be read by the indexing pipeline
        expect(product).toHaveProperty('newArrivalsCategory');
    });
});

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
