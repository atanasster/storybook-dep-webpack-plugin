
export interface IDepencency {
  id: string,
  name: string,
  request: string,
  userRequest: string,
  dependencies: IDependenciesMap,
}
export interface IDependenciesMap {
  [name: string]: IDepencency
}