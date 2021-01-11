import { ReplaceSource } from 'webpack-sources';
import * as path from 'path';
import * as webpack from 'webpack';
import { createHash } from 'crypto';

export interface IPluginOptions {
  filter?: RegExp;
  exclude?: RegExp;
  moduleDirectoryMatch?: RegExp;
  maxLevels?: number;
}

const pick = (o: object, props: string[]) => {
  return props.reduce((r, prop) => ({ ...r, [prop]: o[prop]}), {});
}
class DependenciesPlugin {
  public static pluginName = 'storybook-dep-webpack-plugin';
  private readonly options;
  private stories;
  private projectFolder = null;
  private assets = {};
  private readonly compilationHash: string;
  
  constructor(options: IPluginOptions) {
    const hash = createHash('md5')
      .update(new Date().getTime().toString())
      .digest('hex');
    this.compilationHash = `__${hash.substr(0, 6)}__`;
    this.options = {
      filter: options.filter || /\.(stories|story)\.([tj]sx|[tj]s|mdx)?$/,
      exclude: options.exclude || /^@storybook|@babel/,
      moduleDirectoryMatch: options.moduleDirectoryMatch || /\/index.[tj]s$/,
      maxLevels: options.maxLevels || 10,
      pickProperties: ['id', 'name', 'request'],
      pickModuleProperties: [],
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
            const project = path.dirname(require.main.filename).split(path.sep);
            const node_modules = project.indexOf('node_modules');
            this.projectFolder = project.slice(0, node_modules).join(path.sep);
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
    const nmrp = new webpack.NormalModuleReplacementPlugin(/main\.js$/, resource => {
      if (resource.resource) {
        resource.loaders.push({
          loader: path.join(__dirname, 'runtimeLoader.js'),
          options: JSON.stringify({compilationHash: this.compilationHash}),
        });
      }  
    });
    nmrp.apply(compiler);
  }
  
  private getModuleDependencies(module: any, level: number) {
    if (level < this.options.maxLevels) {
      const dependencies = [...new Set(module.dependencies
        .filter(dep => dep.module && !this.options.exclude.test(dep.request))
        .map((dep) => {
          let effectiveDep = dep;

          if (this.options.moduleDirectoryMatch.test(dep.module.resource) && dep.name) {
            const redirectedTo = dep.module.dependencies.find(l2dep => l2dep.name === dep.id && l2dep.module);
            if (redirectedTo) {
              effectiveDep = redirectedTo;
            }
          }

          const contextPath = this.shortenFolder(effectiveDep.module.context);
          const name = `${effectiveDep.module.debugId}${this.compilationHash}_${effectiveDep.module.dependencies.length}`;
          const asset = this.assets[name];

          if (!asset) {
            const newModule = {
              ...pick(effectiveDep, this.options.pickProperties),
              ...pick(effectiveDep.module, this.options.pickModuleProperties),
              contextPath,
              dependencies: this.getModuleDependencies(effectiveDep.module, level + 1)
            }; 
            this.assets[name] = newModule;
          } else {
            if (effectiveDep.id && !asset.id) {
              asset.id = effectiveDep.id;
              asset.name = effectiveDep.name;
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
