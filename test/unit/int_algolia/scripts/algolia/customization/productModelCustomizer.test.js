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

    test('CATEGORIES_NEW_ARRIVALS in the additional attributes list', () => {
        productModelCustomizer.customizeProductModel(product, ['CATEGORIES_NEW_ARRIVALS']);
        expect(product).toHaveProperty('CATEGORIES_NEW_ARRIVALS');
        expect(product.CATEGORIES_NEW_ARRIVALS).toEqual({
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

    test('CATEGORIES_NEW_ARRIVALS not in the additional attributes list', () => {
        productModelCustomizer.customizeProductModel(product, []);
        // Property is present, but won't be read by the indexing pipeline
        expect(product).toHaveProperty('CATEGORIES_NEW_ARRIVALS');
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

    test('CATEGORIES_NEW_ARRIVALS in the additional attributes list', () => {
        productModelCustomizer.customizeLocalizedProductModel(product, ['CATEGORIES_NEW_ARRIVALS']);
        expect(product).toHaveProperty('CATEGORIES_NEW_ARRIVALS');
        expect(product.CATEGORIES_NEW_ARRIVALS).toEqual({
            level_0: 'New Arrivals',
            level_1: 'New Arrivals > Electronics',
        });
    });

    test('CATEGORIES_NEW_ARRIVALS not in the additional attributes list', () => {
        productModelCustomizer.customizeLocalizedProductModel(product, []);
        expect(product).not.toHaveProperty('CATEGORIES_NEW_ARRIVALS');
    });
});
