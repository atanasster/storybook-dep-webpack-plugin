
export interface IDepencency {
  id: string,
  name: string,
  request: string,
  userRequest: string,
  dependencies: IDependenciesMap,
}
export interface IDependenciesMap {
  maxLevels?: number,
  mapper?: string[],
  compilationHash?: string,
};