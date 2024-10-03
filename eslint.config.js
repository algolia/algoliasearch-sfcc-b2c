const globals = require("globals");
const jquery = require("eslint-plugin-jquery");
const jsdoc = require("eslint-plugin-jsdoc");

module.exports = [{
    ignores: [
        "**/doc/",
        "./*.js",
        "**/jest.setup.js",
        "**/bin/",
        "**/workspace/",
        "cartridges/modules",
        "cartridges/algolia_sg_changes",
        "cartridges/int_algolia_controllers/cartridge/static/default/js/lib",
        "cartridges/int_algolia_sfra/cartridge/static/default/js/lib",
    ],
}, {
    plugins: {
        jquery,
        jsdoc,
    },

    languageOptions: {
        globals: {
            empty: true,
            request: true,
            dw: true,
            XML: true,
            $: true,
        },

        ecmaVersion: 2015,
        sourceType: "script",
    },

    rules: {
        "import/no-unresolved": "off",

        indent: ["error", 4, {
            SwitchCase: 1,
            VariableDeclarator: 1,
        }],

        "func-names": "off",
        "jsdoc/require-jsdoc": "error",

        "vars-on-top": "off",
        "global-require": "off",

        "no-shadow": ["error", {
            allow: ["err", "callback"],
        }],

        "max-len": "off",
    }
}, {
    files: ["eslint.config.js", "test/**/*.js"],
    languageOptions: {
        globals: {
            ...globals.mocha,
        },

        ecmaVersion: "latest",
    },
    rules: {
        "jsdoc/require-jsdoc": "off"
    },
}];
