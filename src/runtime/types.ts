
export interface IDepencency {
  id: string,
  name: string,
  request: string,
  userRequest: string,
  contextPath: string,
  dependencies: string[],
}
export interface IDependenciesMap {
  maxLevels?: number,
  mapper?: string[],
  compilationHash?: string,
};