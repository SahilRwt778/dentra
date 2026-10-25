module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      files: ['src/**/*.ts', 'src/**/*.tsx'],
      excludedFiles: ['src/api/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@/api/generated-api',
                message:
                  'Use a feature module in src/api, or src/api/types for models.',
              },
            ],
            patterns: [
              {
                group: ['@/api/generated/*'],
                message:
                  'Use a feature module in src/api, or src/api/types for models.',
              },
            ],
          },
        ],
      },
    },
  ],
};
