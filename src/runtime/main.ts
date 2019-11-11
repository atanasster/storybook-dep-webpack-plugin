import { IDependenciesMap } from './types';

export const dependenciesMap:string  = '__COMPILATION_HASH__INJECTED_DEPENDENCIES_DATA_PLACEHOLDER__';

type DependencyStringifyFunction = () => IDependenciesMap;

let map: IDependenciesMap = null;


export const getDependencyMap: DependencyStringifyFunction = () => {
  if (map) {
    return map;
  }
  if (dependenciesMap) {
    try {
      map = JSON.parse(dependenciesMap);
    }  
    catch (e) {
      map = {
        error: true,
      }
    }
    return map;
  }
  return undefined;
}  
