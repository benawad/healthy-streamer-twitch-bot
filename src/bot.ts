import "dotenv-safe/config";
import tmi from "tmi.js";
import fetch from "node-fetch";
import { formatDistanceToNowStrict } from "date-fns";
import pino from "pino";

const logger = pino();

// Create a client with our options
const client = tmi.client({
  identity: {
    username: process.env.BOT_USERNAME,
    password: process.env.OAUTH_TOKEN,
  },
  channels: [process.env.CHANNEL_NAME],
});

client.on("connected", (addr, port) => {
  logger.info(`* Connected to ${addr}:${port}`);
});

client.connect();

let go = false;

const start = (createdAt: string) => {
  let counter = 0;
  const f = () => {
    if (!go) {
      logger.info("go is false, stopping recursion");
      return;
    }

    setTimeout(() => {
      if (!counter) {
        logger.info("counter is 0, skipping message");
        counter++;
        return f();
      }

      const streamLength = formatDistanceToNowStrict(new Date(createdAt), {
        unit: "minute",
      });

      if (counter % 3 == 0) {
        logger.info("stand up message sent");
        client.say(
          process.env.CHANNEL_NAME,
          `@${process.env.CHANNEL_NAME} you've been streaming for ${streamLength}, stand up for a second and stretch those legs`
        );
      } else {
        logger.info("close eyes message sent");
        client.say(
          process.env.CHANNEL_NAME,
          `@${process.env.CHANNEL_NAME} you've been streaming for ${streamLength}, close your eyes to rest them for a second`
        );
      }

      counter++;
      logger.info(`new count: ${counter} and calling f()`);
      f();
    }, 1000 * 60 * 20); // 20 mins
  };

  f();
};

setInterval(() => {
  fetch("https://api.twitch.tv/kraken/streams/" + process.env.CHANNEL_ID, {
    headers: {
      Accept: "application/vnd.twitchtv.v5+json",
      Authorization: "OAuth " + process.env.OAUTH_TOKEN.split(":")[1],
    },
  })
    .then((x) => x.json())
    .then((x) => {
      if (!x) {
        logger.info("no response from API");
        return;
      }

      if (x.stream && !go) {
        logger.info("stream just went live, starting healthy bot monitoring");
        go = true;
        start(x.stream.created_at);
      } else if (!x.stream && go) {
        logger.info("stream just went offline, stopping monitoring");
        go = false;
      }
    })
    .catch((err) => console.error(err));
}, 1000 * 60 * 5); // 5 minutes
