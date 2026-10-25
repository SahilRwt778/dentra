module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    './babel-plugin-environment.cjs',
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: { '@': './src' },
      },
    ],
  ],
};
