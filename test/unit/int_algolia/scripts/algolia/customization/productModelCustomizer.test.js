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

    test('newArrivals in the additional attributes list', () => {
        productModelCustomizer.customizeProductModel(product, ['newArrivals']);
        expect(product).toHaveProperty('newArrivals');
        expect(product.newArrivals).toEqual({
            level_0: {
                en: 'New Arrivals',
                fr: 'Nouveautés',
            },
            level_1: {
                en: 'New Arrivals > Electronics',
                fr: 'Nouveautés > Electronique',
            },
        });
    });

    test('newArrivals not in the additional attributes list', () => {
        productModelCustomizer.customizeProductModel(product, []);
        // Property is present, but won't be read by the indexing pipeline
        expect(product).toHaveProperty('newArrivals');
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

    test('newArrivals in the additional attributes list', () => {
        productModelCustomizer.customizeLocalizedProductModel(product, ['newArrivals']);
        expect(product).toHaveProperty('newArrivals');
        expect(product.newArrivals).toEqual({
            level_0: 'New Arrivals',
            level_1: 'New Arrivals > Electronics',
        });
    });

    test('newArrivals not in the additional attributes list', () => {
        productModelCustomizer.customizeLocalizedProductModel(product, []);
        expect(product).not.toHaveProperty('newArrivals');
    });
});
