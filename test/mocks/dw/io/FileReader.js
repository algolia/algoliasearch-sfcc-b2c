// Minimal dw.io.FileReader mock. Test fixtures pass a file-like object that carries the raw
// XML string on `__xmlContent`; this reader exposes that string to the XMLStreamReader mock.
class MockedFileReader {
    constructor(file) {
        this._content = (file && typeof file.__xmlContent === 'string') ? file.__xmlContent : '';
    }
    getString() {
        return this._content;
    }
    readString() {
        return this._content;
    }
    close() {}
}

module.exports = MockedFileReader;
