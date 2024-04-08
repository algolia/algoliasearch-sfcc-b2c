var lastRequestTime = '';


// Listen for AJAX requests
// If the request is an add-to-cart request, check if the last request was less than 4 milliseconds ago
// If it was, abort the request 
// Workaround to not modifying original cartridge code to fix the issue with multiple add-to-cart requests because of adding productTile to the PDP page
$(document).ajaxSend(function(event, jqxhr, settings) {

    if (settings.url.indexOf('Cart-AddProduct') === -1) {
        return;
    }

    var now = Date.now();

    if (lastRequestTime && now - lastRequestTime < 4) {
        jqxhr.abort();
    } else {
        lastRequestTime = now;
    }
});

// Listen for AJAX requests
// If the request is a quick view request, check if the product is not available or not ready to order
// If it is, disable the add to cart button
// Workaround to not modifying original cartridge code to fix the issue with add to cart button is enabled when the product is not available or not ready to order
$(document).ajaxComplete(function(event, jqxhr, settings) { 
    if (settings.url.indexOf('Product-ShowQuickView') === -1) {
        return;
    }

    if (jqxhr.responseJSON && jqxhr.responseJSON.product) {
        var product = jqxhr.responseJSON.product;
        var addToCartBtn = document.querySelectorAll('.add-to-cart-global[data-pid="' + product.id + '"]');
        if (addToCartBtn.length > 0) {
            if (!product.readyToOrder || !product.available) {
                for (var i = 0; i < addToCartBtn.length; i++) {
                    addToCartBtn[i].disabled = true;
                }
            }
        }
    }
});
