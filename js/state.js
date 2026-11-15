// App-wide state. `roles` is loaded from the database (RLS-protected) and
// only decides which controls are SHOWN — every write is authorized again
// by the database, so editing this object in the browser grants nothing.
export const state = {
  session: null,
  user: null,
  roles: [],
  get isDev() { return this.roles.includes('developer') || this.roles.includes('admin'); },
  get isAdmin() { return this.roles.includes('admin'); },
};
