// StAX mocks so the real updateCPObjectFromXML parsing path runs against in-memory XML fixtures.
jest.mock('dw/io/XMLStreamConstants', () => jest.requireActual('../../../../../mocks/dw/io/XMLStreamConstants'), { virtual: true });
jest.mock('dw/io/FileReader', () => jest.requireActual('../../../../../mocks/dw/io/FileReader'), { virtual: true });
jest.mock('dw/io/XMLStreamReader', () => jest.requireActual('../../../../../mocks/dw/io/XMLStreamReader'), { virtual: true });

// Controlled product catalog for the record-level normalization:
// - variantA, variantB are variants of masterX, and masterX lists them as its variants
// - standaloneP is a true standalone product (reports neither master nor variant)
// - any other id (e.g. 'ghost') resolves to no product
jest.mock('dw/catalog/ProductMgr', () => {
    const Variant = jest.requireActual('../../../../../mocks/dw/catalog/Variant');
    const MasterProduct = jest.requireActual('../../../../../mocks/dw/catalog/MasterProduct');
    const collectionHelper = jest.requireActual('../../../../../mocks/helpers/collectionHelper');
    const masterX = new MasterProduct({ ID: 'masterX' });
    const variantA = new Variant({ ID: 'variantA', masterProduct: masterX });
    const variantB = new Variant({ ID: 'variantB', masterProduct: masterX });
    masterX.variants = collectionHelper.createCollection([variantA, variantB]);
    const standaloneP = new MasterProduct({ ID: 'standaloneP' });
    standaloneP.master = false; // true standalone: reports neither master nor variant
    const products = { variantA: variantA, variantB: variantB, masterX: masterX, standaloneP: standaloneP };
    return {
        getProduct: jest.fn(function (id) {
            return Object.prototype.hasOwnProperty.call(products, id) ? products[id] : null;
        }),
    };
}, { virtual: true });

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
// <pricebooks> root closed by </pricebooks> (the terminator the extraction keys on).
const PRICEBOOK_ONE_VARIANT = `<?xml version="1.0" encoding="UTF-8"?>
<pricebooks xmlns="http://www.demandware.com/xml/impex/pricebook/2006-10-31">
    <pricebook>
        <header pricebook-id="usd-list-prices">
            <currency>USD</currency>
            <display-name xml:lang="x-default">List Prices</display-name>
            <online-flag>true</online-flag>
        </header>
        <price-tables>
            <price-table product-id="variantA">
                <amount quantity="1">46.00</amount>
            </price-table>
        </price-tables>
    </pricebook>
</pricebooks>`;

const PRICEBOOK_TWO_VARIANTS_AND_STANDALONE = `<?xml version="1.0" encoding="UTF-8"?>
<pricebooks xmlns="http://www.demandware.com/xml/impex/pricebook/2006-10-31">
    <pricebook>
        <header pricebook-id="usd-sale-prices">
            <currency>USD</currency>
            <parent>usd-list-prices</parent>
        </header>
        <price-tables>
            <price-table product-id="variantA">
                <amount quantity="1">46.00</amount>
            </price-table>
            <price-table product-id="variantB">
                <amount quantity="1">45.00</amount>
            </price-table>
            <price-table product-id="standaloneP">
                <amount quantity="1">19.99</amount>
            </price-table>
        </price-tables>
    </pricebook>
</pricebooks>`;

// A merchant edited a master-level price-table that variants inherit; the delta names the master.
const PRICEBOOK_MASTER_ENTRY = `<?xml version="1.0" encoding="UTF-8"?>
<pricebooks xmlns="http://www.demandware.com/xml/impex/pricebook/2006-10-31">
    <pricebook>
        <header pricebook-id="usd-list-prices">
            <currency>USD</currency>
        </header>
        <price-tables>
            <price-table product-id="masterX">
                <amount quantity="1">50.00</amount>
            </price-table>
        </price-tables>
    </pricebook>
</pricebooks>`;

const PRICEBOOK_UNKNOWN_ID = `<?xml version="1.0" encoding="UTF-8"?>
<pricebooks xmlns="http://www.demandware.com/xml/impex/pricebook/2006-10-31">
    <pricebook>
        <header pricebook-id="usd-list-prices">
            <currency>USD</currency>
        </header>
        <price-tables>
            <price-table product-id="ghost">
                <amount quantity="1">1.00</amount>
            </price-table>
        </price-tables>
    </pricebook>
</pricebooks>`;

// An inventory list delta names the object whose stock record changed, one <record> per entry, under an
// <inventory> root closed by </inventory> (the terminator the extraction keys on).
const INVENTORY_ONE_VARIANT = `<?xml version="1.0" encoding="UTF-8"?>
<inventory xmlns="http://www.demandware.com/xml/impex/inventory/2007-05-31">
    <inventory-list>
        <header list-id="inventory_m">
            <default-instock>false</default-instock>
        </header>
        <records>
            <record product-id="variantA">
                <allocation>100.0</allocation>
                <ats>100.0</ats>
            </record>
        </records>
    </inventory-list>
</inventory>`;

const INVENTORY_TWO_VARIANTS = `<?xml version="1.0" encoding="UTF-8"?>
<inventory xmlns="http://www.demandware.com/xml/impex/inventory/2007-05-31">
    <inventory-list>
        <header list-id="inventory_m">
            <default-instock>false</default-instock>
        </header>
        <records>
            <record product-id="variantA">
                <ats>100.0</ats>
            </record>
            <record product-id="variantB">
                <ats>0.0</ats>
            </record>
        </records>
    </inventory-list>
</inventory>`;

// A catalog delta (produced by CatalogDeltaExport) marks deletions with mode="delete".
const CATALOG = `<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="storefront-catalog">
    <product product-id="variantA">
        <online-flag>true</online-flag>
    </product>
    <product product-id="variantB" mode="delete">
    </product>
</catalog>`;

describe('updateCPObjectFromXML', () => {
    describe('price book extraction', () => {
        test('reads the price-table product-ids', () => {
            const changedProducts = [];
            const result = jobHelper.updateCPObjectFromXML(xmlFile(PRICEBOOK_ONE_VARIANT), changedProducts, 'pricebook', 'variant');

            expect(result.success).toBe(true);
            expect(result.nrProductsRead).toBe(1);
            expect(flatten(changedProducts)).toEqual({ variantA: true });
        });

        test('accumulates across archives and deduplicates a SKU changed in more than one price book', () => {
            const changedProducts = [];
            const first = jobHelper.updateCPObjectFromXML(xmlFile(PRICEBOOK_ONE_VARIANT), changedProducts, 'pricebook', 'variant');
            const second = jobHelper.updateCPObjectFromXML(xmlFile(PRICEBOOK_TWO_VARIANTS_AND_STANDALONE), changedProducts, 'pricebook', 'variant');

            expect(first.success).toBe(true);
            expect(second.success).toBe(true);
            // four <price-table> entries read across the two files, but variantA appears in both
            expect(first.nrProductsRead + second.nrProductsRead).toBe(4);
            expect(flatten(changedProducts)).toEqual({ variantA: true, variantB: true, standaloneP: true });
            expect(jobHelper.getObjectsArrayLength(changedProducts)).toBe(3);
        });

        test('when recordLevel is master, rolls changed variants up to their master, collapsing duplicates', () => {
            const changedProducts = [];
            const result = jobHelper.updateCPObjectFromXML(xmlFile(PRICEBOOK_TWO_VARIANTS_AND_STANDALONE), changedProducts, 'pricebook', 'master');

            expect(result.success).toBe(true);
            expect(result.nrProductsRead).toBe(3); // three <price-table> entries read
            // variantA + variantB collapse onto masterX; the standalone passes through
            expect(flatten(changedProducts)).toEqual({ masterX: true, standaloneP: true });
            expect(jobHelper.getObjectsArrayLength(changedProducts)).toBe(2);
        });

        test('when recordLevel is master, passes a master id through unchanged', () => {
            const changedProducts = [];
            jobHelper.updateCPObjectFromXML(xmlFile(PRICEBOOK_MASTER_ENTRY), changedProducts, 'pricebook', 'master');

            expect(flatten(changedProducts)).toEqual({ masterX: true });
        });

        test('when recordLevel is variant, leaves variants and standalones unchanged', () => {
            const changedProducts = [];
            jobHelper.updateCPObjectFromXML(xmlFile(PRICEBOOK_TWO_VARIANTS_AND_STANDALONE), changedProducts, 'pricebook', 'variant');

            expect(flatten(changedProducts)).toEqual({ variantA: true, variantB: true, standaloneP: true });
        });

        test('when recordLevel is variant, fans a changed master out to its variants', () => {
            const changedProducts = [];
            const result = jobHelper.updateCPObjectFromXML(xmlFile(PRICEBOOK_MASTER_ENTRY), changedProducts, 'pricebook', 'variant');

            expect(result.success).toBe(true);
            expect(result.nrProductsRead).toBe(1); // one <price-table> entry read
            // the master is not an indexed record; its inheriting variants are rebuilt instead
            expect(flatten(changedProducts)).toEqual({ variantA: true, variantB: true });
            expect(jobHelper.getObjectsArrayLength(changedProducts)).toBe(2);
        });

        test('passes an id that resolves to no product through unchanged', () => {
            const changedProducts = [];
            jobHelper.updateCPObjectFromXML(xmlFile(PRICEBOOK_UNKNOWN_ID), changedProducts, 'pricebook', 'master');

            expect(flatten(changedProducts)).toEqual({ ghost: true });
        });
    });

    describe('inventory list extraction', () => {
        test('reads the record product-ids', () => {
            const changedProducts = [];
            const result = jobHelper.updateCPObjectFromXML(xmlFile(INVENTORY_ONE_VARIANT), changedProducts, 'inventory', 'variant');

            expect(result.success).toBe(true);
            expect(result.nrProductsRead).toBe(1);
            expect(flatten(changedProducts)).toEqual({ variantA: true });
        });

        test('when recordLevel is master, rolls changed variants up to their master', () => {
            const changedProducts = [];
            const result = jobHelper.updateCPObjectFromXML(xmlFile(INVENTORY_TWO_VARIANTS), changedProducts, 'inventory', 'master');

            expect(result.success).toBe(true);
            expect(result.nrProductsRead).toBe(2);
            expect(flatten(changedProducts)).toEqual({ masterX: true });
            expect(jobHelper.getObjectsArrayLength(changedProducts)).toBe(1);
        });

        test('when recordLevel is variant, leaves the changed variants unchanged', () => {
            const changedProducts = [];
            jobHelper.updateCPObjectFromXML(xmlFile(INVENTORY_TWO_VARIANTS), changedProducts, 'inventory', 'variant');

            expect(flatten(changedProducts)).toEqual({ variantA: true, variantB: true });
        });
    });

    describe('catalog extraction (unchanged)', () => {
        test('reads product-ids and honors mode="delete"', () => {
            const changedProducts = [];
            const result = jobHelper.updateCPObjectFromXML(xmlFile(CATALOG), changedProducts, 'catalog');

            expect(result.success).toBe(true);
            expect(result.nrProductsRead).toBe(2);
            expect(flatten(changedProducts)).toEqual({ variantA: true, variantB: false });
        });

        test('ignores recordLevel, so the catalog path is untouched', () => {
            const changedProducts = [];
            jobHelper.updateCPObjectFromXML(xmlFile(CATALOG), changedProducts, 'catalog', 'master');

            expect(flatten(changedProducts)).toEqual({ variantA: true, variantB: false });
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
