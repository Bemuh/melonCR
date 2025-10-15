module.exports = {
  plugins: ['import'],
  rules: {
    'import/no-unused-modules': ['warn', { unusedExports: true, missingExports: true }],
  },
};
