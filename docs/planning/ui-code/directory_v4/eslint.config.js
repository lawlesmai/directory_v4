export default [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        fetch: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "error",
      "no-undef": "error",
      "prefer-const": "error",
      "no-var": "error"
    }
  }
];