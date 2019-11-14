
export interface IDependency {
  id: string,
  name: string,
  request: string,
  userRequest: string,
  contextPath: string,
  dependencies: string[],
}
export interface IDependenciesMap {
  error?: boolean,
  maxLevels?: number,
  mapper?: {
    [key:string]: IDependency,
  }
  compilationHash?: string,
};