const session = require("express-session");

class SQLiteSessionStore extends session.Store {
  constructor(database) {
    super();
    this.database = database;
  }

  get(sid, callback) {
    try {
      const row = this.database
        .prepare("SELECT sess, expire FROM app_sessions WHERE sid = ?")
        .get(sid);
      if (!row) return callback(null, null);
      if (row.expire <= Date.now()) {
        this.database
          .prepare("DELETE FROM app_sessions WHERE sid = ?")
          .run(sid);
        return callback(null, null);
      }
      callback(null, JSON.parse(row.sess));
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sess, callback = () => {}) {
    try {
      const expires = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 24 * 60 * 60 * 1000;
      this.database
        .prepare(
          `INSERT INTO app_sessions (sid, sess, expire) VALUES (?, ?, ?)
         ON CONFLICT (sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire`,
        )
        .run(sid, JSON.stringify(sess), expires);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sid, callback = () => {}) {
    try {
      this.database.prepare("DELETE FROM app_sessions WHERE sid = ?").run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, sess, callback = () => {}) {
    try {
      const expires = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 24 * 60 * 60 * 1000;
      this.database
        .prepare("UPDATE app_sessions SET expire = ? WHERE sid = ?")
        .run(expires, sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
}

module.exports = SQLiteSessionStore;
