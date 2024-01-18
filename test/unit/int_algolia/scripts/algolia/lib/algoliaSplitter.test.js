const { splitHtmlContent, getMaxBodySize } = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaSplitter');

jest.mock('dw/util/Bytes', () => {
    class BytesMock {
        constructor(string) {
            this.string = string;
        }

        getLength() {
            return new Blob([this.string]).size;
        }
    }

    return BytesMock;
}, {virtual: true});

jest.mock('dw/util/StringUtils', () => {
    return {
        trim: function (str) { return str; }
    }
}, {virtual: true});

describe('HTML Content Manipulation', () => {
    describe('splitHtmlContent', () => {
        const maxByteSize = 1000;
        const splitterElement = 'div';

        test('should split HTML content by a specified element', () => {
            const htmlContent = '<div>Part 1</div><div>Part 2</div>';
            const result = splitHtmlContent(htmlContent, maxByteSize, splitterElement);
            expect(result).toEqual(['Part 1', 'Part 2']);
        });

        test('should remove restricted tags', () => {
            const htmlContent = '<div><script>Some script</script>Content</div>';
            const result = splitHtmlContent(htmlContent, maxByteSize, splitterElement);
            expect(result).toEqual(['Content']);
        });

        test('should remove all HTML tags', () => {
            const htmlContent = '<div><b>Bold Text</b> and normal text</div>';
            const result = splitHtmlContent(htmlContent, maxByteSize, splitterElement);
            expect(result).toEqual(['Bold Text and normal text']);
        });
    });

    describe('getMaxBodySize', () => {
        test('should calculate max byte size correctly', () => {
            const content = { body: 'Example content', other: 'Other data' };
            const expectedMaxByteSize = 10000 - JSON.stringify({ other: 'Other data' }).length - 300; // Adjust based on your DEFAULT_MAX_RECORD_BYTES and SAFETY_MARGIN
            const result = getMaxBodySize(content);
            expect(result).toBe(expectedMaxByteSize);
        });
    });

});

describe('Extreme Content Manipulation', () => {
    const maxByteSize = 1000;
    const splitterElement = 'div';

    test('should handle large HTML content with many splitter elements', () => {
        const htmlContent = '<div>Part 1</div>'.repeat(100);
        const result = splitHtmlContent(htmlContent, maxByteSize, splitterElement);
        expect(result.length).toBe(100);
        expect(result[99]).toEqual('Part 1');
    });

    test('should correctly handle content just below the max byte size limit', () => {
        const largeContent = 'a'.repeat(maxByteSize - 10);
        const htmlContent = `<div>${largeContent}</div>`;
        const result = splitHtmlContent(htmlContent, maxByteSize, splitterElement);
        expect(result.length).toBe(1);
    });

    test('should correctly calculate max byte size with large non-body fields', () => {
        const content = { body: 'Example content', other: 'a'.repeat(5000) };
        const expectedMaxByteSize = 10000 - JSON.stringify({ other: content.other }).length - 300;
        const result = getMaxBodySize(content);
        expect(result).toBe(expectedMaxByteSize);
    });

    test('should handle empty content object', () => {
        const content = {};
        const expectedMaxByteSize = 10000 - 300;
        const result = getMaxBodySize(content);
        // expect result near to %2 of expectedMaxByteSize
        expect(result).toBeGreaterThan(expectedMaxByteSize * 0.98);
    });
});


