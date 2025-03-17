'use strict';

var server = require('server');
var base = module.superModule;
server.extend(base);

var HookMgr = require('dw/system/HookMgr');
var OrderMgr = require('dw/order/OrderMgr');

server.append('PlaceOrder', function (req, res, next) {

    var orderId = res.viewData.orderID;
    if (!orderId) {
        return next();
    }

    var order = OrderMgr.getOrder(orderId);
    if (!order) {
        return next();
    }

    HookMgr.callHook('dw.ocapi.shop.order.afterPOST', 'afterPOST', order);
    next();
});

module.exports = server.exports();
