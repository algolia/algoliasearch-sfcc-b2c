'use strict';

jest.mock('*/cartridge/scripts/algolia/helper/reindexHelper', () => ({
    sendRetryableBatch: jest.fn().mockReturnValue({ ok: true })
}), { virtual: true });

// Create a configurable mock for algoliaData
const mockConfig = {
    IndexOutOfStock: true,
    InStockThreshold: 5,
    RecordModel: 'master-level',
    AdditionalAttributes: ['storeAvailability', 'in_stock', 'brand', 'description']
};

jest.mock('*/cartridge/scripts/algolia/lib/algoliaData', () => ({
    ...jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaData'),
    getPreference: jest.fn().mockImplementation((id) => {
        switch (id) {
            case 'InStockThreshold':
                return mockConfig.InStockThreshold;
            case 'RecordModel':
                return mockConfig.RecordModel;
            case 'IndexOutOfStock':
                return mockConfig.IndexOutOfStock;
            default:
                return null;
        }
    }),
    getSetOfArray: jest.fn().mockImplementation((id) => {
        switch (id) {
            case 'AdditionalAttributes':
                return mockConfig.AdditionalAttributes;
            default:
                return [];
        }
    })
}), { virtual: true });

const algoliaHooks = require('../../../../../../cartridges/int_algolia_sfra/cartridge/scripts/hooks/order/algoliaHooks');
const MasterVariantMock = require('../../../../../mocks/dw/catalog/MasterProduct');
const VariantMock = require('../../../../../mocks/dw/catalog/Variant');
const collectionHelper = require('../../../../../mocks/helpers/collectionHelper');


// Mock for dw.catalog.StoreMgr with 3 in stock
jest.mock('dw/catalog/StoreMgr', () => ({
    getStore: jest.fn().mockReturnValue({
        inventoryList: {
            getRecord: jest.fn().mockReturnValue({ ATS: { value: 3 } })
        }
    }),
    searchStoresByCoordinates: jest.fn().mockReturnValue({
        empty: true
    })
}), { virtual: true });

// Mock for dw.order.Shipment
class ShipmentMock {
    constructor({ shipmentType, fromStoreId, productLineItems } = {}) {
        this.custom = {
            shipmentType: shipmentType || 'standard',
            fromStoreId: fromStoreId || 'store1'
        };
        this.productLineItems = productLineItems || [];
    }

    getShipments() {
        return this.productLineItems;
    }

    getProductLineItems() {
        return this.productLineItems;
    }
}

describe('Algolia Hooks when IndexOutOfStock is true', function () {

    let mockMasterProduct;
    let mockVariant, mockVariant2;
    let mockShipmentInStore, mockShipmentStandard;

    beforeEach(() => {
        // Configure mock for IndexOutOfStock = true
        mockConfig.IndexOutOfStock = true;

        // Setup common test data
        mockMasterProduct = new MasterVariantMock({
            inventoryList: {
                getRecord: jest.fn().mockReturnValue({ ATS: { value: 3 } })
            }
        });
        mockVariant = new VariantMock({
            ID: '701644031206M',
            variationAttributes: { color: 'JJB52A0', size: '004' },
            masterProduct: mockMasterProduct,
            inventoryList: {
                getRecord: jest.fn().mockReturnValue({ ATS: { value: 3 } })
            }
        });

        mockVariant2 = new VariantMock({
            ID: '701644031207M',
            variationAttributes: { color: 'JJB52A0', size: '004' },
            masterProduct: mockMasterProduct,
            inventoryList: {
                getRecord: jest.fn().mockReturnValue({ ATS: { value: 3 } })
            }
        });

        mockMasterProduct.variants = collectionHelper.createCollection([mockVariant, mockVariant2]);

        mockShipmentInStore = new ShipmentMock({
            shipmentType: 'instore',
            fromStoreId: 'store1',
            productLineItems: [{
                product: mockVariant
            }]
        });

        mockShipmentStandard = new ShipmentMock({
            shipmentType: 'standard',
            productLineItems: [{
                product: mockVariant2
            }]
        });
    });

    test('handleInStorePickupShipment should generate correct operations for master-level record model - out of stock - BOPIS Shipment', function () {
        // Arrange
        const shipment = mockShipmentInStore;
        const threshold = 10;
        const additionalAttributes = ['storeAvailability'];
        const recordModel = 'master-level';

        // Act
        const operations = algoliaHooks.handleInStorePickupShipment(
            shipment,
            threshold,
            additionalAttributes,
            recordModel
        );

        // Assert
        expect(operations).toMatchSnapshot();
    });

    test('handleInStorePickupShipment should generate correct operations for variant-level record model - out of stock - BOPIS Shipment', function () {
        // Arrange
        const shipment = mockShipmentInStore;
        const threshold = 10;
        const additionalAttributes = ['storeAvailability'];
        const recordModel = 'variant-level';

        // Act
        const operations = algoliaHooks.handleInStorePickupShipment(
            shipment,
            threshold,
            additionalAttributes,
            recordModel
        );

        // Assert
        expect(operations).toMatchSnapshot();
    });

    test('handleInStorePickupShipment should generate correct operations for master-level record model - in stock - BOPIS Shipment', function () {
        // Arrange
        const shipment = mockShipmentInStore;
        const threshold = 1;
        const additionalAttributes = ['storeAvailability'];
        const recordModel = 'master-level';

        // Act
        const operations = algoliaHooks.handleInStorePickupShipment(
            shipment,
            threshold,
            additionalAttributes,
            recordModel
        );

        // Assert
        expect(operations).toMatchSnapshot();
    });

    test('handleInStorePickupShipment should generate correct operations for variant-level record model - in stock - BOPIS Shipment', function () {
        // Arrange
        const shipment = mockShipmentInStore;
        const threshold = 1;
        const additionalAttributes = ['storeAvailability'];
        const recordModel = 'variant-level';

        // Act
        const operations = algoliaHooks.handleInStorePickupShipment(
            shipment,
            threshold,
            additionalAttributes,
            recordModel
        );

        // Assert
        expect(operations).toMatchSnapshot();
    });

    test('handleInStorePickupShipment should generate correct operations for master-level record model - in stock - Standard Shipment', function () {
        // Arrange
        const shipment = mockShipmentStandard;
        const threshold = 1;
        const additionalAttributes = ['storeAvailability', 'in_stock'];
        const recordModel = 'master-level';

        // Act
        const operations = algoliaHooks.handleStandardShipment(
            shipment,
            threshold,
            additionalAttributes,
            recordModel
        );

        // Assert
        expect(operations).toMatchSnapshot();
    });

    test('handleInStorePickupShipment should generate correct operations for variant-level record model - in stock - Standard Shipment', function () {
        // Arrange
        const shipment = mockShipmentStandard;
        const threshold = 1;
        const additionalAttributes = ['storeAvailability', 'in_stock'];
        const recordModel = 'variant-level';

        // Act
        const operations = algoliaHooks.handleStandardShipment(
            shipment,
            threshold,
            additionalAttributes,
            recordModel
        );

        // Assert
        expect(operations).toMatchSnapshot();
    });
});

describe('Algolia Hooks when IndexOutOfStock is false', function() {
    let mockMasterProduct;
    let mockVariant, mockVariant2;
    let mockShipmentInStore, mockShipmentStandard;

    beforeEach(() => {
        // Configure mock for IndexOutOfStock = false
        mockConfig.IndexOutOfStock = false;

        // Setup common test data
        mockMasterProduct = new MasterVariantMock({
            inventoryList: {
                getRecord: jest.fn().mockReturnValue({ ATS: { value: 3 } })
            }
        });
        mockVariant = new VariantMock({
            ID: '701644031206M',
            variationAttributes: { color: 'JJB52A0', size: '004' },
            masterProduct: mockMasterProduct,
            inventoryList: {
                getRecord: jest.fn().mockReturnValue({ ATS: { value: 3 } })
            }
        });

        mockVariant2 = new VariantMock({
            ID: '701644031207M',
            variationAttributes: { color: 'JJB52A0', size: '004' },
            masterProduct: mockMasterProduct,
            inventoryList: {
                getRecord: jest.fn().mockReturnValue({ ATS: { value: 3 } })
            }
        });

        mockMasterProduct.variants = collectionHelper.createCollection([mockVariant, mockVariant2]);

        mockShipmentInStore = new ShipmentMock({
            shipmentType: 'instore',
            fromStoreId: 'store1',
            productLineItems: [{
                product: mockVariant
            }]
        });

        mockShipmentStandard = new ShipmentMock({
            shipmentType: 'standard',
            productLineItems: [{
                product: mockVariant2
            }]
        });
    });

    test('handleInStorePickupShipment should generate correct operations for master-level record model - out of stock - BOPIS Shipment', function () {
        // Arrange
        const shipment = mockShipmentInStore;
        const threshold = 10;
        const additionalAttributes = ['storeAvailability'];
        const recordModel = 'master-level';

        // Act
        const operations = algoliaHooks.handleInStorePickupShipment(
            shipment,
            threshold,
            additionalAttributes,
            recordModel
        );

        // Assert
        expect(operations).toMatchSnapshot();
    });

    test('handleInStorePickupShipment should generate correct operations for variant-level record model - out of stock - BOPIS Shipment', function () {
        // Arrange
        const shipment = mockShipmentInStore;
        const threshold = 10;
        const additionalAttributes = ['storeAvailability'];
        const recordModel = 'variant-level';

        // Act
        const operations = algoliaHooks.handleInStorePickupShipment(
            shipment,
            threshold,
            additionalAttributes,
            recordModel
        );

        // Assert
        expect(operations).toMatchSnapshot();
    });

    test('handleInStorePickupShipment should generate correct operations for master-level record model - in stock - BOPIS Shipment', function () {
        // Arrange
        const shipment = mockShipmentInStore;
        const threshold = 1;
        const additionalAttributes = ['storeAvailability'];
        const recordModel = 'master-level';

        // Act
        const operations = algoliaHooks.handleInStorePickupShipment(
            shipment,
            threshold,
            additionalAttributes,
            recordModel
        );

        // Assert
        expect(operations).toMatchSnapshot();
    });

    test('handleInStorePickupShipment should generate correct operations for variant-level record model - in stock - BOPIS Shipment', function () {
        // Arrange
        const shipment = mockShipmentInStore;
        const threshold = 1;
        const additionalAttributes = ['storeAvailability'];
        const recordModel = 'variant-level';

        // Act
        const operations = algoliaHooks.handleInStorePickupShipment(
            shipment,
            threshold,
            additionalAttributes,
            recordModel
        );

        // Assert
        expect(operations).toMatchSnapshot();
    });


    test('handleInStorePickupShipment should generate correct operations for master-level record model - in stock - Standard Shipment', function () {
        // Arrange
        const shipment = mockShipmentStandard;
        const threshold = 5;
        const additionalAttributes = ['storeAvailability', 'in_stock'];
        const recordModel = 'master-level';

        // Act
        const operations = algoliaHooks.handleStandardShipment(
            shipment,
            threshold,
            additionalAttributes,
            recordModel
        );

        // Assert
        expect(operations).toMatchSnapshot();
    });

    test('handleInStorePickupShipment should generate correct operations for variant-level record model - in stock - Standard Shipment', function () {
        // Arrange
        const shipment = mockShipmentStandard;
        const threshold = 5;
        const additionalAttributes = ['storeAvailability', 'in_stock'];
        const recordModel = 'variant-level';

        // Act
        const operations = algoliaHooks.handleStandardShipment(
            shipment,
            threshold,
            additionalAttributes,
            recordModel
        );

        // Assert
        expect(operations).toMatchSnapshot();
    });
});