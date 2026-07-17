// StAX mocks so the real updateCPObjectFromXML parsing path runs against in-memory XML fixtures.
jest.mock('dw/io/XMLStreamConstants', () => jest.requireActual('../../../../../mocks/dw/io/XMLStreamConstants'), { virtual: true });
jest.mock('dw/io/FileReader', () => jest.requireActual('../../../../../mocks/dw/io/FileReader'), { virtual: true });
jest.mock('dw/io/XMLStreamReader', () => jest.requireActual('../../../../../mocks/dw/io/XMLStreamReader'), { virtual: true });

const jobHelper = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/jobHelper');

/**
 * Builds a file-like object carrying the raw XML string, as expected by the FileReader mock.
 * updateCPObjectFromXML only calls exists()/getFullPath() on it and hands it to FileReader.
 * @param {string} content the raw XML the FileReader mock should expose
 * @returns {Object} a file-like stand-in for dw.io.File
 */
function xmlFile(content) {
    return {
        exists: function () { return true; },
        getFullPath: function () { return '/mock/outbox/delta.xml'; },
        __xmlContent: content,
    };
}

/**
 * Flattens the array-of-objects changedProducts structure into a single plain object.
 * @param {Array} changedProducts the accumulator updateCPObjectFromXML writes into
 * @returns {Object} a map of product id to availability flag
 */
function flatten(changedProducts) {
    return changedProducts.reduce(function (acc, obj) { return Object.assign(acc, obj); }, {});
}

// A price book delta names the object whose price-table changed, one <price-table> per entry, under a
// <pricebooks> root. This one carries two distinct SKUs, matching a Price Books delta export archive.
const PRICEBOOK_LIST = `<?xml version="1.0" encoding="UTF-8"?>
<pricebooks xmlns="http://www.demandware.com/xml/impex/pricebook/2006-10-31">
    <pricebook>
        <header pricebook-id="cny-m-list-prices">
            <currency>CNY</currency>
            <display-name xml:lang="x-default">List Prices</display-name>
            <online-flag>true</online-flag>
        </header>
        <price-tables>
            <price-table product-id="701644457976M">
                <amount quantity="1">303.00</amount>
            </price-table>
            <price-table product-id="701644457983M">
                <amount quantity="1">299.00</amount>
            </price-table>
        </price-tables>
    </pricebook>
</pricebooks>`;

// A second price book (a sale book inheriting from the list book) that re-lists one of the SKUs above.
const PRICEBOOK_SALE = `<?xml version="1.0" encoding="UTF-8"?>
<pricebooks xmlns="http://www.demandware.com/xml/impex/pricebook/2006-10-31">
    <pricebook>
        <header pricebook-id="cny-m-sale-prices">
            <currency>CNY</currency>
            <parent>cny-m-list-prices</parent>
        </header>
        <price-tables>
            <price-table product-id="701644457976M">
                <amount quantity="1">280.00</amount>
            </price-table>
        </price-tables>
    </pricebook>
</pricebooks>`;

// An inventory list delta names the object whose stock record changed, one <record> per entry, under an
// <inventory> root closed by </inventory> (the terminator the extraction keys on).
const INVENTORY = `<?xml version="1.0" encoding="UTF-8"?>
<inventory xmlns="http://www.demandware.com/xml/impex/inventory/2007-05-31">
    <inventory-list>
        <header list-id="inventory_m">
            <default-instock>false</default-instock>
        </header>
        <records>
            <record product-id="701644457976M">
                <allocation>100.0</allocation>
                <ats>100.0</ats>
            </record>
            <record product-id="701644457983M">
                <ats>0.0</ats>
            </record>
        </records>
    </inventory-list>
</inventory>`;

// A catalog delta (produced by CatalogDeltaExport) marks deletions with mode="delete".
const CATALOG = `<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="storefront-catalog">
    <product product-id="701644457976M">
        <online-flag>true</online-flag>
    </product>
    <product product-id="701644457983M" mode="delete">
    </product>
</catalog>`;

describe('updateCPObjectFromXML', () => {
    describe('price book extraction', () => {
        test('reads every price-table product-id and marks it available', () => {
            const changedProducts = [];
            const result = jobHelper.updateCPObjectFromXML(xmlFile(PRICEBOOK_LIST), changedProducts, 'pricebook');

            expect(result.success).toBe(true);
            expect(result.nrProductsRead).toBe(2);
            expect(flatten(changedProducts)).toEqual({ '701644457976M': true, '701644457983M': true });
        });

        test('accumulates across archives and deduplicates a SKU changed in more than one price book', () => {
            const changedProducts = [];
            const first = jobHelper.updateCPObjectFromXML(xmlFile(PRICEBOOK_LIST), changedProducts, 'pricebook');
            const second = jobHelper.updateCPObjectFromXML(xmlFile(PRICEBOOK_SALE), changedProducts, 'pricebook');

            expect(first.success).toBe(true);
            expect(second.success).toBe(true);
            // three <price-table> entries read across the two files, but 701644457976M appears in both
            expect(first.nrProductsRead + second.nrProductsRead).toBe(3);
            expect(flatten(changedProducts)).toEqual({ '701644457976M': true, '701644457983M': true });
            expect(jobHelper.getObjectsArrayLength(changedProducts)).toBe(2);
        });
    });

    describe('inventory list extraction', () => {
        test('reads every record product-id and marks it available', () => {
            const changedProducts = [];
            const result = jobHelper.updateCPObjectFromXML(xmlFile(INVENTORY), changedProducts, 'inventory');

            expect(result.success).toBe(true);
            expect(result.nrProductsRead).toBe(2);
            expect(flatten(changedProducts)).toEqual({ '701644457976M': true, '701644457983M': true });
        });
    });

    describe('catalog extraction', () => {
        test('reads product-ids and honors mode="delete"', () => {
            const changedProducts = [];
            const result = jobHelper.updateCPObjectFromXML(xmlFile(CATALOG), changedProducts, 'catalog');

            expect(result.success).toBe(true);
            expect(result.nrProductsRead).toBe(2);
            expect(flatten(changedProducts)).toEqual({ '701644457976M': true, '701644457983M': false });
        });
    });

    describe('error handling', () => {
        test('returns success=false with an error message when reading throws', () => {
            const badFile = {
                exists: function () { return true; },
                getFullPath: function () { return '/mock/outbox/broken.xml'; },
                get __xmlContent() { throw new Error('read failure'); },
            };
            const changedProducts = [];
            const result = jobHelper.updateCPObjectFromXML(badFile, changedProducts, 'pricebook');

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain('Error while reading from file');
        });
    });
});
