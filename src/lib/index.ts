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
  private dependencies = {};
  private readonly compilationHash: string;
  
  constructor(options) {
    const hash = createHash('md5')
      .update(new Date().getTime().toString())
      .digest('hex');
    this.compilationHash = `__${hash.substr(0, 6)}__`;
    this.options = {
      filter:  /\.(stories|story)\.[tj]sx?$/,
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
      compilation.hooks.finishModules.tap(DependenciesPlugin.pluginName, (modules: any[]) => {
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
            this.replaceSource(compilation, file, JSON.stringify(this.assets, null, 0));
          })
        })
      });
    });
  }

  private shortenFolder(path: string): string {
    if (path && this.projectFolder) {
      return path.replace(this.projectFolder, '');
    }
    return path;
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
      return [...new Set(module.dependencies
            .filter(dep => dep.module && !this.options.exclude.test(dep.request))
            .map((dep) => {
              const name = `${this.shortenFolder(dep.module.context)}___${dep.id || ''}___${dep.name || ''}___${dep.module.dependencies.length}`;
              if (!this.assets[name]) {
                const newModule = {
                  ...pick(dep, this.options.pickProperties),
                  ...pick(dep.module, this.options.pickModuleProperties),
                  dependencies: this.getModuleDependencies(dep.module, level + 1)
                }; 
                this.assets[name] = newModule;
              }
              return name;
            })
          )];
    } else {
      return undefined;
    }
  };
  private replaceSource(compilation: webpack.compilation.Compilation, file: string, content: string) {
    const placeholder = `${this.compilationHash}INJECTED_DEPENDENCIES_DATA_PLACEHOLDER__`;
    const source = compilation.assets[file];
    const placeholderPos = source.source().indexOf(placeholder);
    if (placeholderPos > -1) {
      const newSource = new ReplaceSource(source, file);
      newSource.replace(
        placeholderPos,
        placeholderPos + placeholder.length - 1,
        content
      );
      compilation.assets[file] = newSource;
    }
  }  
}

module.exports = DependenciesPlugin;
