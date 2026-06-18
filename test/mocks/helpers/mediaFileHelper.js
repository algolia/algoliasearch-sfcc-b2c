/**
 * Wraps plain image fixtures (which can come from a JSON file, so they cannot
 * carry methods) into dw.content.MediaFile-like mocks that expose both the
 * direct properties (alt, absURL, title) and the getter methods (getAlt,
 * getAbsURL, getTitle) used by code that accesses MediaFile through the SFCC API.
 * @param {Array<Object>} images - array of plain image fixtures
 * @returns {Array<Object>} array of MediaFile-like mocks
 */
function decorate(images) {
    return (images || []).map(function (image) {
        return {
            alt: image.alt,
            absURL: image.absURL,
            title: image.title,
            getAlt: function () {
                return image.alt;
            },
            getAbsURL: function () {
                return image.absURL;
            },
            getTitle: function () {
                return image.title;
            },
        };
    });
}

module.exports = {
    decorate: decorate,
};
