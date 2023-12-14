"use strict";
const OFF = 0;
const WARNING = 1;
const ERROR = 2;

module.exports = {
  root: true,
  extends: ["airbnb"],
  parserOptions: {
    ecmaVersion: 2020,
  },

  /*
   * it fixes eslint-plugin-jsdoc's reports: "Invalid JSDoc tag name "template" jsdoc/check-tag-names"
   * refs: https://github.com/gajus/eslint-plugin-jsdoc#check-tag-names
   */
  settings: {
    jsdoc: {
      mode: "typescript",
    },
  },

  overrides: [
    {
      files: ["tests/**/*"],
      env: { mocha: true },
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "CallExpression[callee.object.name='assert'][callee.property.name='doesNotThrow']",
            message:
              "`assert.doesNotThrow()` should be replaced with a comment next to the code.",
          },
        ],

        // Overcome https://github.com/mysticatea/eslint-plugin-node/issues/250
        "node/no-unsupported-features/es-syntax": [
          "error",
          {
            ignores: ["modules", "dynamicImport"],
          },
        ],
      },
    },
  ],
  rules: {
    // override/add rules settings here, such as:
    'no-unused-vars': WARNING,
    'prefer-const': WARNING,
    'no-const-assign': ERROR,
    'no-undef': ERROR,
    "quotes": [2, "double", { "avoidEscape": true }],
    "arrow-parens": [WARNING, "as-needed"],
    "semi": OFF,
    "no-param-reassign": OFF,
    "no-plusplus": OFF,
    "quote-props": OFF,
  },
};
