const workoutRouter = require("express").Router();
const Workout = require("../models/Workout");
const Activity = require("../models/Activity");
const Score = require("../models/Score");
const passport = require("passport");

// passport protected route(s)
// http://www.passportjs.org/docs/authenticate/
workoutRouter.get(
  "/",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const workouts = await Workout.find({ user: req.user.id });
    res.json(workouts.map(w => w.toJSON()));
  }
);

// try not to use this, since it returns the whole dataset
workoutRouter.get(
  "/all",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const workouts = await Workout.find({}).populate("activity");
    res.json(workouts.map(w => w.toJSON()));
  }
);

workoutRouter.get(
  "/:userid",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const workouts = await Workout.find({ user: req.params.userid }).populate(
      "activity"
    );
    res.json(workouts.map(w => w.toJSON()));
  }
);

workoutRouter.post(
  "/",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const activity = req.body.activity;
    const workoutExists = await Workout.findOne({
      user: req.user.id,
      activity
    });
    if (workoutExists) {
      const updatedWorkout = await createWorkoutInstance(
        req.body,
        workoutExists
      );
      res.json(updatedWorkout.toJSON());
    } else {
      const workout = new Workout({
        instances: [{ date: req.body.date, amount: req.body.amount }],
        user: req.user.id,
        activity
      });

      const createdWorkout = await workout.save();
      res.status(201).json(createdWorkout.toJSON());
    }
  }
);

// Identical operation to post "/" above
workoutRouter.post(
  "/:activityid",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const activity = req.params.activityid;
    const workoutExists = await Workout.findOne({
      user: req.user.id,
      activity
    });
    if (workoutExists) {
      const updatedWorkout = await createWorkoutInstance(
        { date: req.body.date, amount: req.body.amount },
        workoutExists
      );
      res.json(updatedWorkout.toJSON());
    } else {
      const workout = new Workout({
        instances: [{ date: req.body.date, amount: req.body.amount }],
        user: req.user.id,
        activity
      });

      const createdWorkout = await workout.save();
      res.status(201).json(createdWorkout.toJSON());
    }
  }
);

// TODO: allow user to update only their own workout
workoutRouter.put(
  "/:id",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const activity = await Activity.findById(req.body.activity);
    const workout = await Workout.findById(req.params.id);
    if (!activity || !workout) {
      return res.status(400).send({
        error: "Could not find the activity or the workout."
      });
    }

    const oldInstance = workout.instances.find(i => {
      return i._id.toString() === req.body.instance.id;
    });
    if (!oldInstance) {
      return res
        .status(400)
        .send({ error: "Could not find the workout instance" });
    }

    // if user set amount to 0, filter out this instance
    if (req.body.instance.amount === 0) {
      workout.instances = workout.instances.filter(
        i => i._id.toString() !== req.body.instance.id
      );
      // delete the workout if instances array got emptied
      if (workout.instances.length === 0) {
        await Workout.findByIdAndRemove(workout.id);
        res.status(204).end();
      }
    } else {
      // user changed the amount
      workout.instances = workout.instances.map(i =>
        i._id.toString() !== req.body.instance.id
          ? i
          : {
              date: req.body.instance.date,
              amount: req.body.instance.amount,
              _id: i._id
            }
      );
    }

    const updatedWorkout = await Workout.findByIdAndUpdate(
      workout.id,
      workout,
      { new: true }
    );
    res.json(updatedWorkout.toJSON());
  }
);

workoutRouter.delete(
  "/:id",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const workout = await Workout.findById(req.params.id);
    if (workout && workout.user.toString() === req.user.id.toString()) {
      await Workout.findByIdAndRemove(req.params.id);
      res.status(204).end();
    } else {
      res.status(404).send({
        error: "Could not delete the workout."
      });
    }
  }
);

async function createWorkoutInstance(instance, workoutExists) {
  // is there an instance for this day already?
  const repeated = workoutExists.instances.find(i => {
    return i.date.toISOString().substr(0, 10) === instance.date;
  });

  if (repeated) {
    const summed = {
      _id: repeated._id,
      date: repeated.date,
      amount: repeated.amount + instance.amount
    };

    workoutExists.instances = workoutExists.instances.map(i =>
      i.date !== summed.date ? i : summed
    );
  } else {
    workoutExists.instances = [
      ...workoutExists.instances,
      {
        date: instance.date,
        amount: instance.amount
      }
    ];
  }

  const updatedWorkout = await Workout.findByIdAndUpdate(
    workoutExists.id,
    workoutExists,
    {
      new: true
    }
  );
  return updatedWorkout;
}

async function createWorkout(req, activityid) {
  const workout = new Workout({
    instances: [{ date: req.body.date, amount: req.body.amount }],
    user: req.user.id,
    activity: activityid
  });

  const createdWorkout = await workout.save();
  return createdWorkout;
}

module.exports = workoutRouter;
