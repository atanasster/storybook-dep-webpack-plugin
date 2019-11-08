import { IDependenciesMap } from './types';

export const dependenciesMap:string  = '__COMPILATION_HASH__INJECTED_DEPENDENCIES_DATA_PLACEHOLDER__';

type DependencyStringifyFunction = () => IDependenciesMap;

let map: IDependenciesMap = null;


export const getDependencyMap: DependencyStringifyFunction = () => {
  if (map) {
    return map;
  }
  if (dependenciesMap) {
    map = JSON.parse(dependenciesMap);
    return map;
  }
  return undefined;
}  
