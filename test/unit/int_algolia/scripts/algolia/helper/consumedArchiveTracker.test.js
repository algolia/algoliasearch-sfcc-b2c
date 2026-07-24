const GlobalMock = require('../../../../../mocks/global');
global.empty = GlobalMock.empty;

const CustomObjectMgr = require('dw/object/CustomObjectMgr');

const consumedArchiveTracker = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/consumedArchiveTracker');

const CUSTOM_OBJECT_TYPE = 'AlgoliaConsumedDeltaArchive';

describe('isConsumed', () => {
    test('returns false when no custom object exists for the archive', () => {
        CustomObjectMgr.getCustomObject.mockReturnValueOnce(null);

        expect(consumedArchiveTracker.isConsumed('AlgoliaPriceDeltaIndex', 'algolia', 'pricebookDeltaExport', '000001.zip')).toBe(false);
        expect(CustomObjectMgr.getCustomObject).toHaveBeenCalledWith(CUSTOM_OBJECT_TYPE, 'AlgoliaPriceDeltaIndex__algolia__pricebookDeltaExport__000001.zip');
    });

    test('returns true when a custom object exists for the archive', () => {
        CustomObjectMgr.getCustomObject.mockReturnValueOnce({ custom: {} });

        expect(consumedArchiveTracker.isConsumed('AlgoliaPriceDeltaIndex', 'algolia', 'pricebookDeltaExport', '000001.zip')).toBe(true);
    });
});

describe('markConsumed', () => {
    test('creates one custom object per archive with the expected key and attributes', () => {
        CustomObjectMgr.getCustomObject.mockReturnValue(null);
        const createdCustomObjects = [];
        CustomObjectMgr.createCustomObject.mockImplementation(() => {
            const customObject = { custom: {} };
            createdCustomObjects.push(customObject);
            return customObject;
        });

        const success = consumedArchiveTracker.markConsumed('AlgoliaInventoryDeltaIndex', 'algolia', 'inventoryDeltaExport', ['000001.zip', '000002.zip']);

        expect(success).toBe(true);
        expect(CustomObjectMgr.createCustomObject).toHaveBeenCalledTimes(2);
        expect(CustomObjectMgr.createCustomObject).toHaveBeenNthCalledWith(1, CUSTOM_OBJECT_TYPE, 'AlgoliaInventoryDeltaIndex__algolia__inventoryDeltaExport__000001.zip');
        expect(CustomObjectMgr.createCustomObject).toHaveBeenNthCalledWith(2, CUSTOM_OBJECT_TYPE, 'AlgoliaInventoryDeltaIndex__algolia__inventoryDeltaExport__000002.zip');
        expect(createdCustomObjects[0].custom).toEqual({
            consumer: 'algolia',
            deltaExportJobName: 'inventoryDeltaExport',
            archiveName: '000001.zip',
            jobID: 'AlgoliaInventoryDeltaIndex',
        });

        CustomObjectMgr.getCustomObject.mockReset();
    });

    test('skips archives that are already recorded', () => {
        CustomObjectMgr.getCustomObject.mockReturnValueOnce({ custom: {} }); // 000001.zip already recorded
        CustomObjectMgr.getCustomObject.mockReturnValueOnce(null);

        const success = consumedArchiveTracker.markConsumed('AlgoliaPriceDeltaIndex', 'algolia', 'pricebookDeltaExport', ['000001.zip', '000002.zip']);

        expect(success).toBe(true);
        expect(CustomObjectMgr.createCustomObject).toHaveBeenCalledTimes(1);
        expect(CustomObjectMgr.createCustomObject).toHaveBeenCalledWith(CUSTOM_OBJECT_TYPE, 'AlgoliaPriceDeltaIndex__algolia__pricebookDeltaExport__000002.zip');
    });

    test('records the same archive independently for different consuming jobs', () => {
        CustomObjectMgr.getCustomObject.mockReturnValue(null);

        consumedArchiveTracker.markConsumed('AlgoliaPriceDeltaIndex_locales1', 'algolia', 'pricebookDeltaExport', ['000001.zip']);
        consumedArchiveTracker.markConsumed('AlgoliaPriceDeltaIndex_locales2', 'algolia', 'pricebookDeltaExport', ['000001.zip']);

        expect(CustomObjectMgr.createCustomObject).toHaveBeenCalledTimes(2);
        expect(CustomObjectMgr.createCustomObject).toHaveBeenNthCalledWith(1, CUSTOM_OBJECT_TYPE, 'AlgoliaPriceDeltaIndex_locales1__algolia__pricebookDeltaExport__000001.zip');
        expect(CustomObjectMgr.createCustomObject).toHaveBeenNthCalledWith(2, CUSTOM_OBJECT_TYPE, 'AlgoliaPriceDeltaIndex_locales2__algolia__pricebookDeltaExport__000001.zip');

        CustomObjectMgr.getCustomObject.mockReset();
    });

    test('returns false when creating a custom object fails, but still records the others', () => {
        CustomObjectMgr.getCustomObject.mockReturnValue(null);
        CustomObjectMgr.createCustomObject.mockImplementationOnce(() => {
            throw new Error('duplicate key');
        });
        CustomObjectMgr.createCustomObject.mockImplementationOnce(() => ({ custom: {} }));

        const success = consumedArchiveTracker.markConsumed('AlgoliaPriceDeltaIndex', 'algolia', 'pricebookDeltaExport', ['000001.zip', '000002.zip']);

        expect(success).toBe(false);
        expect(CustomObjectMgr.createCustomObject).toHaveBeenCalledTimes(2);

        CustomObjectMgr.getCustomObject.mockReset();
    });
});
