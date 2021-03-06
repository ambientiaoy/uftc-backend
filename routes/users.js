const config = require("../utils/config");
const usersRouter = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");

const passport = require("passport");
const jwt = require("jsonwebtoken");

const abbreviate = name => {
  const nameArray = name.split(" ");
  if (nameArray.length === 1) return name; // nickname?

  // feature: Tommy Lee Jones  =>  Tommy L.
  return nameArray[0] + " " + nameArray[1][0] + ".";
};

// passport protected route(s)
// http://www.passportjs.org/docs/authenticate/
usersRouter.get(
  "/me",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    // If this function gets called, authentication was successful.
    // 'req.user' contains the authenticated user.
    const user = await User.findById(req.user.id);
    res.json(user);
  }
);

usersRouter.get(
  "/",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const users = await User.find({});
    res.json(
      users.map(u => {
        return {
          id: u._id.toString(),
          name: abbreviate(u.name)
        };
      })
    );
  }
);

// unprotected routes
usersRouter.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, location, secret } = req.body;

    if (secret !== config.SECRET_FOR_REGISTERING) {
      return res
        .status(400)
        .json({ error: "Use the proper link to register." });
    }

    const taken = await User.findOne({ email });
    if (taken) {
      return res
        .status(400)
        .json({ error: "You already have an account, log in instead." });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = new User({
      name,
      email,
      password: passwordHash,
      location,
      activeChallenge: null
    });

    const savedUser = await user.save();
    res.json({ savedUser });
  } catch (exception) {
    next(exception);
  }
});

usersRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  const passwordCorrect =
    user === null ? false : await bcrypt.compare(password, user.password);

  if (!(user && passwordCorrect)) {
    return res.status(401).json({ error: "invalid username or password" });
  }

  const userForToken = {
    name: user.name,
    id: user._id
  };

  const token = jwt.sign(userForToken, config.SECRET);

  res.status(200).send({
    token: `Bearer ${token}`,
    id: user._id,
    name: user.name,
    location: user.location,
    activeChallenge: user.activeChallenge
  });
});

usersRouter.put(
  "/:id",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    if (req.user.id !== req.params.id) {
      return res.status(400).send({
        error: "Can only update your own info"
      });
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true
    });
    res.json(updatedUser.toJSON());
  }
);

module.exports = usersRouter;
