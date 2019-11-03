import { ReplaceSource } from 'webpack-sources';
import * as path from 'path';
import * as webpack from 'webpack';
import pick from 'lodash/pick';
import { createHash } from 'crypto';

class DependenciesPlugin {
  public static pluginName = 'storybook-dep-webpack-plugin';
  private readonly options;
  private stories;
  private projectFolder = null;
  private assets = {};
  private readonly compilationHash: string;
  
  constructor(options) {
    const hash = createHash('md5')
      .update(new Date().getTime().toString())
      .digest('hex');
    this.compilationHash = `__${hash.substr(0, 6)}__`;
    this.options = {
      filter: /\.(stories|story)\.[tj]sx?$/,
      exclude: /^@storybook|@babel/,
      maxLevels: 10,
      pickProperties: ['id', 'name', 'request'],
      pickModuleProperties: [],
      ...options,
    };
  }

  apply(compiler: webpack.Compiler) {
    this.replaceRuntimeModule(compiler);
    compiler.hooks.compilation.tap(DependenciesPlugin.pluginName, compilation => {
      compilation.hooks.optimizeModules.tap(DependenciesPlugin.pluginName, (modules: any[]) => {
        this.stories = modules.filter((module) => {
          if (!module.resource) {
            return false;
          }
          if (typeof this.options.filter === 'function') {
            return this.options.filter(module.resource);
          }
          return this.options.filter.test(module.resource);
        });
        this.stories.forEach(story => {
          if (!this.projectFolder) {
            const project = path.dirname(require.main.filename).split('/');
            const node_modules = project.indexOf('node_modules');
            this.projectFolder = project.slice(0, node_modules).join('/');
          }  
          const dependencies = this.getModuleDependencies(story, 0);
          this.assets[this.shortenFolder(story.userRequest)] = {
            ...pick(story, this.options.pickProperties),
            ...pick(story.module, this.options.pickModuleProperties),
            dependencies,
          }  
        });
      });
      compilation.hooks.optimizeChunkAssets.tap(DependenciesPlugin.pluginName, (chunks) => {
        chunks.forEach(chunk => {
          chunk.files
          .filter(fileName => fileName.endsWith('.js'))
          .forEach(file => {
            this.replaceSource(compilation, file, this.assets);
          })
        })
      });
    });
  }

  private shortenFolder(dir: string): string {
    if (dir && this.projectFolder) {
      return path.resolve(__dirname, dir).replace(this.projectFolder, '');
    }
    return dir;
  }

  private replaceRuntimeModule(compiler) {
    const runtimePath = path.resolve(__dirname, '../runtime/main.js');
    const nmrp = new webpack.NormalModuleReplacementPlugin(/main\.js$/, resource => {
      if (resource.resource !== runtimePath) {
        return;
      }
      resource.loaders.push({
        loader: path.join(__dirname, 'runtimeLoader.js'),
        options: JSON.stringify({compilationHash: this.compilationHash}),
      });
    });
    nmrp.apply(compiler);
  }
  
  private getModuleDependencies(module: any, level: number) {
    if (level < this.options.maxLevels) {
      const dependencies = [...new Set(module.dependencies
        .filter(dep => dep.module && !this.options.exclude.test(dep.request))
        .map((dep) => {
          const contextPath = this.shortenFolder(dep.module.context);
          const name = `${dep.module.debugId}${this.compilationHash}_${dep.module.dependencies.length}`;
          const asset = this.assets[name];
          if (!asset) {
            const newModule = {
              ...pick(dep, this.options.pickProperties),
              ...pick(dep.module, this.options.pickModuleProperties),
              contextPath,
              dependencies: this.getModuleDependencies(dep.module, level + 1)
            }; 
            this.assets[name] = newModule;
          } else {
            if (dep.id && !asset.id) {
              asset.id = dep.id;
              asset.name = dep.name;
            }
          }
          return name;
        }))];

        if (!dependencies || !dependencies.length) {
          return undefined;
        }
        // reduce the list of dependencies to only unique by context
        // keep the ones with an id or name as preferred
        const map = new Map();
        for (const key of dependencies as string[]) {
          const contextPath = key.substring(0, key.indexOf(this.compilationHash));
          let items = map.get(contextPath);
          const item = this.assets[key];
          if (!items) {
            items = [key]
          } else {
            if (item.id || item.name) {
              const emptyKey = `${contextPath}${this.compilationHash}_`;
              const emptySlotIdx =  items.findIndex(key => key.startsWith(emptyKey));
              if (emptySlotIdx >= 0) {
                items.splice(emptySlotIdx,1);
              }  
              items.push(key);
            }
          }
          map.set(contextPath, items);
        }
        const result = [];
        map.forEach(value => value.forEach(key => result.push(key)))
        return result;
    } else {
      return undefined;
    }
  };
  private replaceSource(compilation: webpack.compilation.Compilation, file: string, content: object) {
    const placeholder = `${this.compilationHash}INJECTED_DEPENDENCIES_DATA_PLACEHOLDER__`;
    const source = compilation.assets[file];
    const placeholderPos = source.source().indexOf(placeholder);
    if (placeholderPos > -1) {
      const newContent = JSON.stringify({
        maxLevels: this.options.maxLevels,
        mapper: content,
        compilationHash: this.compilationHash,
      })
      const newSource = new ReplaceSource(source, file);
      newSource.replace(
        placeholderPos,
        placeholderPos + placeholder.length - 1,
        newContent
      );
      compilation.assets[file] = newSource;
    }
  }  
}

module.exports = DependenciesPlugin;
