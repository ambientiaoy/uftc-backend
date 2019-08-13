const activityRouter = require("express").Router();
const Activity = require("../models/Activity");
const passport = require("passport");
const slug = require("slug");

// unprotected routes
activityRouter.get("/", async (req, res) => {
  const activities = await Activity.find({});
  res.json(activities.map(a => a.toJSON()));
});

// passport protected route(s)
// http://www.passportjs.org/docs/authenticate/
activityRouter.post(
  "/",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const activity = new Activity({
      name: req.body.name,
      points: req.body.points,
      type: req.body.type,
      unit: req.body.unit,
      description: req.body.description,
      url: req.body.url,
      icon: req.body.icon
    });

    // the slug versions of activity.name need to be unique
    const activities = await Activity.find({});
    const name = slug(req.body.name, { lower: true });
    for (let a of activities) {
      if (slug(a.name, { lower: true }) === name) {
        res
          .status(400)
          .json({ error: "Activity name would not be unique as an URL" });
      }
    }

    try {
      const createdActivity = await activity.save();
      res.status(201).json(createdActivity.toJSON());
    } catch (error) {
      res.status(400).json({ error: "Could not add the activity" });
    }
  }
);

module.exports = activityRouter;
