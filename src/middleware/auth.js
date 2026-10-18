function requireAuth(database) {
  return async (req, res, next) => {
    if (!req.session.userId) return res.redirect("/login");

    try {
      const user = database
        .prepare(
          "SELECT id, name, email, role, approval_status, contact_email, job_title, bio, avatar_color FROM users WHERE id = ?",
        )
        .get(req.session.userId);
      if (!user || user.approval_status !== "approved") {
        req.session.destroy(() => {});
        return res.redirect("/login");
      }

      req.user = user;
      res.locals.currentUser = req.user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.redirect("/dashboard");
  next();
}

module.exports = { requireAuth, requireAdmin };
