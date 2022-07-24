import { auth, Client } from "twitter-api-sdk";
import express from "express";
import dotenv from "dotenv";

const configPath =
  process.env.NODE_ENV === "production" ? "./.env" : "./.env.dev";

dotenv.config({ path: configPath, debug: !!process.env.DEBUG });

const app = express();

const authClient = new auth.OAuth2User({
  client_id: process.env.CLIENT_ID as string,
  client_secret: process.env.CLIENT_SECRET as string,
  callback: "http://127.0.0.1:3000/callback",
  scopes: [
    "tweet.read",
    "users.read",
    "tweet.write",
    "follows.read",
    "follows.write",
    "offline.access",
    "like.read",
    "like.write",
  ],
});

const client = new Client(authClient);

const STATE = "my-state";

app.get("/callback", async function (req, res) {
  try {
    const { code, state } = req.query;
    if (state !== STATE) return res.status(500).send("State isn't matching");
    await authClient.requestAccessToken(code as string);
    res.redirect("/tweets");
  } catch (error) {
    console.log(error);
  }
});

app.get("/login", async function (req, res) {
  const authUrl = authClient.generateAuthURL({
    state: STATE,
    code_challenge_method: "s256",
  });

  res.redirect(authUrl);
});

app.get("/tweets", async function (req, res) {
  let { username } = req.query;
  if (typeof username !== "string") {
    const { data: me } = await client.users.findMyUser();
    if (typeof me?.username !== "string") return res.sendStatus(400);
    username = me.username;
  }

  const { data: user } = await client.users.findUserByUsername(username);
  const userId = user?.id;
  if (typeof userId !== "string") return res.sendStatus(404);

  const tweets = await client.tweets.usersIdTimeline(userId, {
    exclude: ["replies", "retweets"],
    expansions: ["author_id"],
    "tweet.fields": ["lang", "public_metrics"],
    "media.fields": ["type", "public_metrics"],
    "user.fields": [
      "id",
      "name",
      "username",
      "verified",
      "public_metrics",
      "entities",
    ],
  });
  res.send(tweets);
});

app.get("/revoke", async function (req, res) {
  try {
    const response = await authClient.revokeAccessToken();
    res.send(response);
  } catch (error) {
    console.log(error);
  }
});

app.listen(3000, () => {
  console.log(`Go here to login: http://127.0.0.1:3000/login`);
});
