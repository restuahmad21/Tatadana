function requireAuth(database) {
  return async (req, res, next) => {
    const userId = req.session.user?.id || req.session.userId;
    if (!userId) return res.redirect("/login");

    try {
      const user = database
        .prepare(
          "SELECT id, name, email, role, approval_status, contact_email, job_title, bio, avatar_color FROM users WHERE id = ?",
        )
        .get(userId);
      if (!user || user.approval_status !== "approved") {
        req.session.destroy(() => {});
        return res.redirect("/login");
      }

      req.user = user;
      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };
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
