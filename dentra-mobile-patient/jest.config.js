module.exports = {
  preset: '@react-native/jest-preset',
  modulePaths: ['<rootDir>/node_modules'],
  setupFilesAfterEnv: ['./jest.setup.js'],
  transform: { '^.+\\.(js|jsx|mjs|ts|tsx)$': 'babel-jest' },
  transformIgnorePatterns: [
    'node_modules/(?!(@dentra/(video|call-core)|(jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*|lucide-react-native|react-redux|@reduxjs|immer)/)',
  ],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
