'use strict';

jest.mock('*/cartridge/scripts/algolia/helper/reindexHelper', () => ({
    sendRetryableBatch: jest.fn().mockReturnValue({ ok: true })
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

// Mock for dw.order.Order
class OrderMock {
    constructor({ orderNo, shipments } = {}) {
        this.orderNo = orderNo || '12345';
        this.shipments = shipments || [];
    }

    getShipments() {
        return this.shipments;
    }
}

describe('Algolia Hooks', function () {
    // Mock these modules for tests
    beforeAll(() => {
        jest.mock('*/cartridge/scripts/algolia/lib/algoliaData', () => ({
            getPreference: jest.fn().mockImplementation((id) => {
                switch (id) {
                    case 'InStockThreshold':
                        return 5;
                    case 'RecordModel':
                        return 'master-level';
                    case 'IndexOutOfStock':
                        return true; 
                    default:
                        return null;
                }
            }),
            getSetOfArray: jest.fn().mockImplementation((id) => {
                switch (id) {
                    case 'AdditionalAttributes':
                        return ['storeAvailability', 'in_stock'];
                    default:
                        return [];
                }
            })
        }), { virtual: true });
    });

    let mockMasterProduct;
    let mockVariant, mockVariant2;
    let mockOrder;
    let mockShipmentInStore, mockShipmentStandard;

    beforeEach(() => {
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
        });

        mockVariant2 = new VariantMock({
            ID: '701644031207M',
            variationAttributes: { color: 'JJB52A0', size: '004' },
            masterProduct: mockMasterProduct,
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

        mockOrder = new OrderMock({
            orderNo: '12345',
            shipments: [mockShipmentInStore, mockShipmentStandard]
        });
    });

    test('inventoryUpdate should handle in-store pickup shipment correctly', function () {
        const Status = require('dw/system/Status');
        // Arrange
        const order = mockOrder;
        
        // Act
        const result = algoliaHooks.inventoryUpdate(order);
        
        // Assert
        expect(result).toBeInstanceOf(Status);
    });

    test('handleInStorePickupShipment should generate correct operations for master-level record model - out of stock - storeAvailability', function () {
        // Arrange
        const shipment = mockShipmentInStore;
        const threshold = 5;
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

    test('handleInStorePickupShipment should generate correct operations for variant-level record model - out of stock - storeAvailability', function () {
        // Arrange
        const shipment = mockShipmentInStore;
        const threshold = 5;
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


    test('handleStandardShipment should generate correct operations for out of stock products - in_stock - should records be deleted', function () {
        // Arrange
        const shipment = mockShipmentStandard;
        const threshold = 10;
        const additionalAttributes = ['in_stock'];
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

    test('handleStandardShipment should generate correct operations for in-stock products - in_stock', function () {
        // Arrange
        const shipment = mockShipmentStandard;
        const threshold = 1;
        const additionalAttributes = ['in_stock'];
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
});