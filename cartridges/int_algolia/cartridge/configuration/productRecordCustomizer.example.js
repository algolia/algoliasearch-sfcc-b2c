// Product records customizer example file
// The exported function will be executed after all attributes have been
// fetched, just before sending the record to Algolia for indexing.
module.exports = function(algoliaRecord) {
    if (algoliaRecord.colorVariations) {
        algoliaRecord['availableColors'] = algoliaRecord.colorVariations.length;
    }
}
