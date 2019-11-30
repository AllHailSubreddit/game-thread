if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const logger = require("./lib/logger");
const moment = require("moment-timezone");
const ncaa = require("./lib/ncaa");
const reddit = require("./lib/reddit");
const storage = require("./lib/storage");

const now = moment.utc();
const next2Hours = moment.utc(now).add(4, "hours");

async function main() {
  logger.info("start");

  // retrieve the stored game data
  logger.debug(`retrieving stored game data`);
  let storedGames;
  try {
    storedGames = await storage.getAll();
    logger.debug(`stored games: ${storedGames.length}`);
  } catch (error) {
    logger.error(error, "failed to retrieve stored game data");
    return;
  }
  const storedGameIds = storedGames.map(({ id }) => id);

  const relevantGames = storedGames
    .map(convertStartToMoment())
    .filter(isRelevantGame());
  const relevantGameIds = relevantGames.map(({ id }) => id);
  logger.debug(`relevant games: ${relevantGames.length}`);

  const summaryThreadIds = [];
  const liveThreadIds = [];
  const updatedIds = [];
  const deletedIds = [];

  for (let storedGame of relevantGames) {
    const { id } = storedGame;

    // pull the latest game data
    logger.debug(`pulling the latest game data for ${id}`);
    let ncaaGame;
    try {
      ncaaGame = await ncaa.getGameInfoById(id);
      logger.info(`latest game data pulled for ${id}`);
    } catch (error) {
      logger.error(error, `failed to retrieve updated game data for ${id}`);
      continue;
    }

    if (isPostGame(storedGame) && isReadyForSummaryThread(ncaaGame)) {
      // create the summary thread
      logger.debug(`creating summary thread for ${id}`);
      let summaryThreadUrl;
      try {
        const { url } = await reddit.createSummaryThread(ncaaGame);
        summaryThreadUrl = url;
        summaryThreadIds.push(id);
        logger.info(`summary thread created for ${id} at ${summaryThreadUrl}`);
      } catch (error) {
        logger.error(error, `failed to create summary thread for ${id}`);
        continue;
      }

      // if a live thread exists, lock it and point to the summary thread
      if (storedGame.liveThreadId) {
        logger.debug(`locking live thread for ${id}`);
        try {
          const { url } = await reddit.lockLiveThread(
            storedGame.liveThreadId,
            summaryThreadUrl
          );
          logger.info(`locked live thread for ${id} at ${url}`);
        } catch (error) {
          logger.error(
            error,
            `failed to lock live thread with ID ${storedGame.liveThreadId} for ${id}`
          );
        }
      }

      // cleanup old data
      logger.debug(`deleting stored game data file for ${id}`);
      try {
        await storage.deleteById(id);
        deletedIds.push(id);
        logger.info(`stored game data file deleted for ${id}`);
      } catch (error) {
        logger.error(error, `failed to delete stored game data file for ${id}`);
      }
    } else {
      let newStoredGame = {
        ...storedGame,
        state: ncaaGame.status.gameState.toLowerCase(),
        start: moment
          .unix(ncaaGame.status.startTimeEpoch)
          .utc()
          .toISOString(),
      };

      if (isLiveThreadablePreGame(storedGame)) {
        // create a live thread for the game
        logger.debug(`creating live thread for ${id}`);
        try {
          const { name: liveThreadId, url } = await reddit.createLiveThread(
            ncaaGame
          );
          newStoredGame.liveThreadId = liveThreadId;
          liveThreadIds.push(id);
          logger.info(`live thread created for ${id} at ${url}`);
        } catch (error) {
          logger.error(error, `failed to create live thread for ${id}`);
        }
      }

      // only store the new game data if the data is different and the file
      // still exists (something else could've removed it)
      if (!isEqualStoredGame(storedGame, newStoredGame)) {
        logger.debug(`storing new game data for ${id}`);
        try {
          await storage.putIfExists(id, newStoredGame);
          updatedIds.push(id);
          logger.info(`new game data stored for ${id}`);
        } catch (error) {
          logger.error(error, `failed to store new game data for ${id}`);
        }
      } else {
        logger.info(`no new game data to store for ${id}`);
      }
    }
  }

  logger.info(
    {
      storedGameIds,
      storedGamesCount: storedGames.length,
      relevantGameIds,
      relevantGamesCount: relevantGames.length,
      summaryThreadIds,
      summaryThreadCount: summaryThreadIds.length,
      liveThreadIds,
      liveThreadCount: liveThreadIds.length,
      updatedIds,
      updatedCount: updatedIds.length,
      deletedIds,
      deletedCount: deletedIds.length,
    },
    "complete"
  );
}

// check if this is the entry script
if (require.main === module) {
  main();
}

function convertStartToMoment() {
  return storedGame => ({
    ...storedGame,
    start: moment.utc(storedGame.start),
  });
}

function isLiveThreadablePreGame(storedGame) {
  return (
    storedGame.state === "pre" &&
    storedGame.liveThreadEligible &&
    storedGame.liveThreadId === null &&
    storedGame.start.isBefore(next2Hours, "minute")
  );
}

function isLiveGame(storedGame) {
  return storedGame.state === "live" || storedGame.start.isBefore(now);
}

function isPostGame(storedGame) {
  return storedGame.state === "final" && storedGame.start.isBefore(now);
}

function isRelevantGame() {
  return storedGame =>
    isLiveThreadablePreGame(storedGame) ||
    isLiveGame(storedGame) ||
    isPostGame(storedGame);
}

function isReadyForSummaryThread(ncaaGame) {
  return ncaaGame.status.gameState === "final" && ncaaGame.status.winner;
}

function isEqualStoredGame(a, b) {
  return (
    a.id === b.id &&
    a.liveThreadEligible === b.liveThreadEligible &&
    a.liveThreadId === b.liveThreadId &&
    a.start.isSame(b.start, "minute") &&
    a.state === b.state
  );
}
