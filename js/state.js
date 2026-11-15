// App-wide state. Everything here only decides what is SHOWN. Every write is
// authorized again by the database, so editing this object grants nothing.
export const state = {
  session: null,
  user: null,
  roles: [],        // lore_user_roles (e.g. 'admin'), read from the database
  devUntil: null,   // expiry of the active Developer Mode session (server-side)
  get isDev() { return !!this.devUntil && new Date(this.devUntil) > new Date(); },
  get isAdmin() { return this.isDev && this.roles.includes('admin'); },
};
