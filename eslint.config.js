const globals = require('globals');
const js = require('@eslint/js');
const jquery = require('eslint-plugin-jquery');
const jsdoc = require('eslint-plugin-jsdoc');
const pluginCypress = require('eslint-plugin-cypress/flat');


module.exports = [
    js.configs.recommended,
    pluginCypress.configs.recommended,
    {
        ignores: [
            '**/doc/',
            './*.js',
            '**/jest.setup.js',
            '**/bin/',
            '**/workspace/',
            'cartridges/modules',
            'cartridges/algolia_sg_changes',
            'cartridges/int_algolia_controllers/cartridge/static/default/js/lib',
            'cartridges/int_algolia_sfra/cartridge/static/default/js/lib',
        ],
    },
    {
        plugins: {
            jquery,
            jsdoc,
        },

        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                empty: true,
                request: true,
                dw: true,
                XML: true,
                $: true,
                session: true,
            },

            ecmaVersion: 2015,
            sourceType: 'script',
        },

        rules: {
            'import/no-unresolved': 'off',

            indent: [
                'error',
                4,
                {
                    SwitchCase: 1,
                    VariableDeclarator: 1,
                },
            ],

            'func-names': 'off',
            'jsdoc/require-jsdoc': 'error',

            'vars-on-top': 'off',

            'no-shadow': [
                'error',
                {
                    allow: ['err', 'callback'],
                },
            ],
        },
    },
    {
        files: ['eslint.config.js', 'jest.config.js', 'test/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.jest,
                ...globals.node,
            },

            ecmaVersion: 'latest',
        },
        rules: {
            'jsdoc/require-jsdoc': 'off',
        },
    },
];
