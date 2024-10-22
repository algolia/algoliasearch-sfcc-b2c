const {
    contentLinkHandler
} = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/contentUtil');

describe('contentLinkHandler', () => {

    it('should replace URL tokens in the body text', () => {
        const result = contentLinkHandler('$Url(action, arg1, arg2)$');
        expect(result).toBe('/on/demandware.store/Sites-Algolia_SFRA-Site/default/action?arg1=arg2');
    });

    it('should replace HTTP URL tokens in the body text', () => {
        const result = contentLinkHandler('$httpUrl(action, arg1, arg2)$');
        expect(result).toBe('http://test.commercecloud.salesforce.com/on/demandware.store/Sites-Algolia_SFRA-Site/default/action?arg1=arg2');
    });

    it('should replace HTTPS URL tokens in the body text', () => {
        const result = contentLinkHandler('$httpsUrl(action, arg1, arg2)$');
        expect(result).toBe('https://test.commercecloud.salesforce.com/on/demandware.store/Sites-Algolia_SFRA-Site/default/action?arg1=arg2');
    });

    it('should return an empty string if the body is not provided', () => {
        const result = contentLinkHandler();
        expect(result).toBe('');
    });

    it('should return changed body', () => {
        const testHTML = `<!DOCTYPE html>
            <html>
            <head>
                <title>Test Page</title>
            </head>
            <body>
                <p>This is a test page.</p>
                <a href="$url(action, arg1, arg2)$">URL Token</a>
                <a href="$httpUrl(action, arg1, arg2)$">HTTP URL Token</a>
                <a href="$httpsUrl(action, arg1, arg2)$">HTTPS URL Token</a>
            </body>
            </html>`;
        const result = contentLinkHandler(testHTML);
        expect(result).toMatchSnapshot();
    });


});
