const express = require("express");
const path = require("path");

const router = express.Router();

const publicDir = path.join(
  __dirname,
  "..",
  "..",
  "public"
);

function requirePageAuth(
  req,
  res,
  next
) {
  if (!req.session?.userId) {
    return res.redirect("/login");
  }

  next();
}

router.get("/", (req, res) => {
  if (!req.session?.userId) {
    return res.redirect("/login");
  }

  return res.sendFile(
    path.join(
      publicDir,
      "index.html"
    )
  );
});

router.get(
  "/terms",
  (req, res) => {
    return res.sendFile(
      path.join(
        publicDir,
        "terms.html"
      )
    );
  }
);

router.get(
  "/privacy",
  (req, res) => {
    return res.sendFile(
      path.join(
        publicDir,
        "privacy.html"
      )
    );
  }
);

router.get(
  "/login",
  (req, res) => {
    if (req.session?.userId) {
      return res.redirect("/");
    }

    return res.sendFile(
      path.join(
        publicDir,
        "login.html"
      )
    );
  }
);

router.get(
  "/tasks",
  requirePageAuth,
  (req, res) => {
    return res.sendFile(
      path.join(
        publicDir,
        "tasks.html"
      )
    );
  }
);

router.get(
  "/calendar",
  (req, res) => {
    return res.sendFile(
      path.join(
        publicDir,
        "calendar.html"
      )
    );
  }
);

router.get(
  "/today",
  (req, res) => {
    return res.sendFile(
      path.join(
        publicDir,
        "today.html"
      )
    );
  }
);

router.get(
  "/tasks/:id",
  (req, res) => {
    return res.sendFile(
      path.join(
        publicDir,
        "task.html"
      )
    );
  }
);

router.get(
  "/routines",
  (req, res) => {
    return res.sendFile(
      path.join(
        publicDir,
        "routines.html"
      )
    );
  }
);

module.exports = router;
