// Variables compartidas por todos los middlewares/routes. Si un middleware
// agrega una variable, la declara acá. `user` queda en AuthEnv porque ahí es
// required (lo setea requireAuth).

export interface AppVariables {
  request_id?: string;
}