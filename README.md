# storybook-dep-webpack-plugin

A webpack plugin to collect dependencies data.<br />
Works in conjunction with [storybook-addon-deps](https://github.com/atanasster/storybook-addon-deps/)

![Dependencies plugin](./doc/storybook_dependencies.gif)

## Live demo
[grommet-controls](https://atanasster.github.io/grommet-controls/?path=/docs/controls-controls-avatar--main)


## Installation
```sh
npm i -D storybook-dep-webpack-plugin
```

## Usage

You can register the plugin in two deifferent ways

### 1. New way - inside your storybook `main.js` webpack settings you will register the plugin:

```js
const DependenciesPlugin = require('storybook-dep-webpack-plugin');

module.exports = {
...
  webpack: async (config, { configType }) => ({
    ...config,
    plugins: [
      ...config.plugins,
      new DependenciesPlugin()
    ]
  }),
...
};

```

### 2. Older way - in your storybook `webpack.config.js` file, add and configure the plugin:

```js
const DependenciesPlugin = require('storybook-dep-webpack-plugin');

module.exports = ({ config, mode }) => {
  ...
  config.plugins.push(new DependenciesPlugin());
  ...
  return config;
};
```

## Options
**filter** - a RegExp or function to select the stories.<br/>
example: 
```
  config.plugins.push(new DependenciesPlugin({
    filter: (resource) => {
      return /\.(stories|story)\.[tj]sx?$/.test(resource) && resource.indexOf("Avatar") > -1;
    }
  }));
```

**exclude** - a RegExp for the modules to exclude.<br/>
example: 
```
  config.plugins.push(new DependenciesPlugin({
    filter: /^@storybook|@babel/,
  }));
```

**maxLevels** - How many levels deep to follow the dependencies.<br/>
example: 
```
  config.plugins.push(new DependenciesPlugin({
    maxLevels: 10,
  }));
```

**pickProperties** - An array of the props to pick from the module webpack data.<br/>
example: 
```
  config.plugins.push(new DependenciesPlugin({
    pickProperties: ['id', 'name', 'request'],
  }));
```

**pickModuleProperties** - An array of the props to pick from the module.module webpack data.<br/>
example: 
```
  config.plugins.push(new DependenciesPlugin({
    pickModuleProperties: [],
  }));
```

## Install and configure `storybook-addon-deps`
[storybook-addon-deps](https://github.com/atanasster/storybook-addon-deps/blob/master/README.md)

