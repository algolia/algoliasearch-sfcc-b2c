'use strict';

/* The changedProducts structure is an array of objects, introduced as a workaround
* to Salesforce B2C's API quota limitations (collections can store 20K elements,
* while objects can store 2K elements). By using an array of objects, we can store
* up to 40M elements in a single collection.
* The structure looks like this:
*  [
*    {
*      "productID1": true,
*      "productID2": false,
*      ...
*      "productID2000": true
*    },
*    {
*      "productID2001": true,
*      ...
*      "productID4000": false
*    },
*    ...
*    {
*      "productID38000001": true,
*      ...
*      "productID38002000": false
*    }
*  ]
*
/**
* @class CPObjectIterator
* @description Iterator for the changedProducts array of objects structure used in the delta export job
* @param {Array} changedProducts The array of objects structure
* @constructor
*/
const CPObjectIterator = function(changedProducts) {
    this.changedProducts = changedProducts;
    this.currentArrayIndex = null;
    this.currentObjectIndex = null;

    this.currentObject = null;
    this.currentObjectKeys = null;
}

CPObjectIterator.prototype.next = function() {
    // structure should have at least one element, which means at least one array element and one object property
    if (!Array.isArray(this.changedProducts) || this.changedProducts.length === 0 || Object.keys(this.changedProducts[0]).length === 0) {
        return null;
    }

    // first element, we know at this point that the structure has at least one element
    if (this.currentArrayIndex === null && this.currentObjectIndex === null) {
        this.currentArrayIndex = 0;
        this.currentObjectIndex = 0;
        // last property in the object, switch to the next object in the array
    } else if (this.currentObjectIndex === this.currentObjectKeys.length - 1) {
        this.currentArrayIndex++;
        this.currentObjectIndex = 0;
        // continuing in the same object
    } else {
        this.currentObjectIndex++;
    }

    // there's no next element
    if (this.currentArrayIndex === this.changedProducts.length) {
        return null;
    } else { // still within the bounds of the array
        this.currentObject = this.changedProducts[this.currentArrayIndex];
        this.currentObjectKeys = Object.keys(this.currentObject);

        // this shouldn't happen, but return if the last element is an empty object
        if (this.currentObjectKeys.length === 0) return null;

        let productID = this.currentObjectKeys[this.currentObjectIndex];
        let available = this.currentObject[productID];

        return {
            productID: productID,
            available: available,
        }
    }
}

module.exports = CPObjectIterator;
