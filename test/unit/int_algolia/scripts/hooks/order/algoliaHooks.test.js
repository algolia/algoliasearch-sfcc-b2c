'use strict';

jest.mock('*/cartridge/scripts/algolia/helper/reindexHelper', () => ({
    sendRetryableBatch: jest.fn().mockReturnValue({ ok: true })
}), { virtual: true });

let mockConfig = {
    IndexOutOfStock: true,
    InStockThreshold: 10,
    RecordModel: 'master-level',
    AdditionalAttributes: ['storeAvailability', 'short_description', 'brand']
};

const algoliaLocalizedProduct = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/model/algoliaLocalizedProduct');

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

// Helper function to setup common test data
function setupTestData() {

    algoliaLocalizedProduct.__setThreshold(mockConfig.InStockThreshold);
    algoliaLocalizedProduct.__setIndexOutOfStock(mockConfig.IndexOutOfStock);
    algoliaLocalizedProduct.__setAttributeList(mockConfig.AdditionalAttributes);

    const mockMasterProduct = new MasterVariantMock({
        inventoryList: {
            getRecord: jest.fn().mockReturnValue({ ATS: { value: 3 } })
        }
    });

    const mockVariant = new VariantMock({
        ID: '701644031206M',
        variationAttributes: { color: 'JJB52A0', size: '004' },
        masterProduct: mockMasterProduct,
        inventoryList: {
            getRecord: jest.fn().mockReturnValue({ ATS: { value: 3 } })
        }
    });

    const mockVariant2 = new VariantMock({
        ID: '701644031207M',
        variationAttributes: { color: 'JJB52A0', size: '004' },
        masterProduct: mockMasterProduct,
        inventoryList: {
            getRecord: jest.fn().mockReturnValue({ ATS: { value: 3 } })
        }
    });

    mockMasterProduct.variants = collectionHelper.createCollection([mockVariant, mockVariant2]);

    const mockShipmentInStore = new ShipmentMock({
        shipmentType: 'instore',
        fromStoreId: 'store1',
        productLineItems: [{
            product: mockVariant
        }]
    });

    const mockShipmentStandard = new ShipmentMock({
        shipmentType: 'standard',
        productLineItems: [{
            product: mockVariant2
        }]
    });

    return {
        mockMasterProduct,
        mockVariant,
        mockVariant2,
        mockShipmentInStore,
        mockShipmentStandard
    };
}

describe('Algolia Hooks - Out of Stock Tests (InStockThreshold: 10, IndexOutOfStock: true)', function () {
    let testData;

    beforeEach(() => {
        // Configure mock for out of stock scenario with IndexOutOfStock = true
        mockConfig.InStockThreshold = 10;
        mockConfig.IndexOutOfStock = true;
        testData = setupTestData();
    });

    test('handleStandardShipment should generate correct operations for master-level record model - out of stock - Standard Shipment', function () {
        // Arrange
        const shipment = testData.mockShipmentStandard;
        const threshold = 10;
        const additionalAttributes = ['storeAvailability', 'short_description', 'brand'];
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

    test('handleStandardShipment should generate correct operations for variant-level record model - out of stock - Standard Shipment', function () {
        // Arrange
        const shipment = testData.mockShipmentStandard;
        const threshold = 10;
        const additionalAttributes = ['storeAvailability', 'short_description', 'brand'];
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

describe('Algolia Hooks - Out of Stock Tests for BOPIS (InStockThreshold: 5, IndexOutOfStock: true)', function () {
    let testData;

    beforeEach(() => {
        // Configure mock for out of stock scenario with IndexOutOfStock = true
        mockConfig.InStockThreshold = 5;
        mockConfig.IndexOutOfStock = true;
        testData = setupTestData();
    });

    test('handleInStorePickupShipment should generate correct operations for master-level record model - out of stock - BOPIS Shipment', function () {
        // Arrange
        const shipment = testData.mockShipmentInStore;
        const threshold = 5;
        const additionalAttributes = ['storeAvailability', 'short_description', 'brand'];
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
        const shipment = testData.mockShipmentInStore;
        const threshold = 5;
        const additionalAttributes = ['storeAvailability', 'short_description', 'brand'];
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
});

describe('Algolia Hooks - Out of Stock Tests (InStockThreshold: 10, IndexOutOfStock: false)', function () {
    let testData;

    beforeEach(() => {
        // Configure mock for out of stock scenario with IndexOutOfStock = false
        mockConfig.InStockThreshold = 10;
        mockConfig.IndexOutOfStock = false;
        testData = setupTestData();
    });


    test('handleStandardShipment should generate correct operations for master-level record model - out of stock - Standard Shipment', function () {
        // Arrange
        const shipment = testData.mockShipmentStandard;
        const threshold = 10;
        const additionalAttributes = ['storeAvailability', 'short_description', 'brand'];
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

    test('handleStandardShipment should generate correct operations for variant-level record model - out of stock - Standard Shipment', function () {
        // Arrange
        const shipment = testData.mockShipmentStandard;
        const threshold = 10;
        const additionalAttributes = ['storeAvailability', 'short_description', 'brand'];
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

describe('Algolia Hooks - Out of Stock Tests for BOPIS (InStockThreshold: 5, IndexOutOfStock: false)', function () {
    let testData;

    beforeEach(() => {
        // Configure mock for out of stock scenario with IndexOutOfStock = false
        mockConfig.InStockThreshold = 5;
        mockConfig.IndexOutOfStock = false;
        testData = setupTestData();
    });

    test('handleInStorePickupShipment should generate correct operations for master-level record model - out of stock - BOPIS Shipment', function () {
        // Arrange
        const shipment = testData.mockShipmentInStore;
        const threshold = 5;
        const additionalAttributes = ['storeAvailability', 'short_description', 'brand'];
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
        const shipment = testData.mockShipmentInStore;
        const threshold = 5;
        const additionalAttributes = ['storeAvailability', 'short_description', 'brand'];
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
});

describe('Algolia Hooks - In Stock Tests (InStockThreshold: 1, IndexOutOfStock: true)', function () {
    let testData;

    beforeEach(() => {
        // Configure mock for in stock scenario with IndexOutOfStock = true
        mockConfig.InStockThreshold = 1;
        mockConfig.IndexOutOfStock = true;
        testData = setupTestData();
    });

    test('handleInStorePickupShipment should generate correct operations for master-level record model - in stock - BOPIS Shipment', function () {
        // Arrange
        const shipment = testData.mockShipmentInStore;
        const threshold = 1;
        const additionalAttributes = ['storeAvailability', 'short_description', 'brand'];
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
        const shipment = testData.mockShipmentInStore;
        const threshold = 1;
        const additionalAttributes = ['storeAvailability', 'short_description', 'brand'];
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

    test('handleStandardShipment should generate correct operations for master-level record model - in stock - Standard Shipment', function () {
        // Arrange
        const shipment = testData.mockShipmentStandard;
        const threshold = 1;
        const additionalAttributes = ['storeAvailability', 'in_stock', 'short_description', 'brand'];
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

    test('handleStandardShipment should generate correct operations for variant-level record model - in stock - Standard Shipment', function () {
        // Arrange
        const shipment = testData.mockShipmentStandard;
        const threshold = 1;
        const additionalAttributes = ['storeAvailability', 'in_stock', 'short_description', 'brand'];
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

describe('Algolia Hooks - In Stock Tests (InStockThreshold: 1, IndexOutOfStock: false)', function () {
    let testData;

    beforeEach(() => {
        // Configure mock for in stock scenario with IndexOutOfStock = false
        mockConfig.InStockThreshold = 1;
        mockConfig.IndexOutOfStock = false;
        testData = setupTestData();
    });

    test('handleInStorePickupShipment should generate correct operations for master-level record model - in stock - BOPIS Shipment', function () {
        // Arrange
        const shipment = testData.mockShipmentInStore;
        const threshold = 1;
        const additionalAttributes = ['storeAvailability', 'short_description', 'brand'];
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
        const shipment = testData.mockShipmentInStore;
        const threshold = 1;
        const additionalAttributes = ['storeAvailability', 'short_description', 'brand'];
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

    test('handleStandardShipment should generate correct operations for master-level record model - in stock - Standard Shipment', function () {
        // Arrange
        const shipment = testData.mockShipmentStandard;
        const threshold = 1;
        const additionalAttributes = ['storeAvailability', 'short_description', 'brand'];
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

    test('handleStandardShipment should generate correct operations for variant-level record model - in stock - Standard Shipment', function () {
        // Arrange
        const shipment = testData.mockShipmentStandard;
        const threshold = 1;
        const additionalAttributes = ['storeAvailability', 'short_description', 'brand'];
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