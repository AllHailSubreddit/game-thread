if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const logger = require("./lib/logger");
const moment = require("moment-timezone");
const ncaa = require("./lib/ncaa");
const storage = require("./lib/storage");

const now = moment.utc();

async function main() {
  logger.info("start");

  // get IDs of games we're already tracking
  logger.debug("retrieving existing IDs");
  let existingIds;
  try {
    existingIds = await storage.listIds();
    logger.info("existing IDs retrieved");
  } catch (error) {
    logger.error(error, "failed to retrieve existing IDs");
    return;
  }

  // retrieve all of the games happening today for all sports
  logger.debug("retrieving scoreboards for all sports");
  let scoreboards;
  try {
    scoreboards = await ncaa.getAllScoreboardsForToday();
    logger.info("scoreboards retrieved for all sports");
  } catch (error) {
    logger.error(error, "failed to retrieve scoreboards");
    return;
  }

  const games = scoreboards
    .flatMap(unwrapGames())
    .map(augmentGame())
    .filter(isValidTeamGame("louisville"))
    .filter(isValidGameState(["pre", "live"]))
    .filter(isValidStartTime(now))
    .filter(isValidId(existingIds))
    .map(formatForStorage());
  const gameIds = games.map(({ id }) => id);

  const storedGameIds = [];
  for (let game of games) {
    try {
      await storage.put(game.id, game);
      logger.debug(`new game stored: ${game.id}`);
      storedGameIds.push(game.id);
    } catch (error) {
      logger.error(error, `failed to store game ${game.id}`);
    }
  }

  logger.info(
    {
      existingGameIds: existingIds,
      existingGamesCount: existingIds.length,
      newGameIds: gameIds,
      newGamesCount: gameIds.length,
      storedGameIds,
      storedGamesCount: storedGameIds.length,
    },
    "complete"
  );
}

// check if this is the entry script
if (require.main === module) {
  main();
}

/**
 * Returns the unwrapped games within a scoreboard. Scoreboard contain game
 * objects that are wrapped in a couple of other objects. For example:
 *
 * {
 *   "games": [
 *     {
 *       game: {
 *         ... <- the data we want
 *       }
 *     }
 *   ]
 * }
 */
function unwrapGames() {
  return scoreboard => scoreboard.games.map(({ game }) => game);
}

/**
 * Returns a new object containing the game data and additional data used for
 * filtering and formatting.
 */
function augmentGame() {
  return game => ({
    ...game,
    id: game.url.split("/").slice(-1)[0],
    startTimeMoment: moment.unix(game.startTimeEpoch).utc(),
    liveThreadEligible:
      // is a tournament game
      !!game.bracketId ||
      // is a top-25 matchup
      [game.home.rank, game.away.rank].every(
        rank => !!rank && +rank >= 1 && +rank <= 25
      ) ||
      // is a rivalry game
      [
        game.home.names.seo.toLowerCase(),
        game.away.names.seo.toLowerCase(),
      ].some(name => name === "kentucky"),
  });
}

/**
 * Tests whether either team name matches the name provided.
 */
function isValidTeamGame(team) {
  return game =>
    [
      game.home.names.seo.toLowerCase(),
      game.away.names.seo.toLowerCase(),
    ].includes(team.toLowerCase());
}

/**
 * Tests whether the game state matches any of the provided states.
 */
function isValidGameState(states) {
  return game => states.includes(game.gameState.toLowerCase());
}

/**
 * Tests whether the game occurs after the provided limit.
 */
function isValidStartTime(limit) {
  return game => game.startTimeMoment.isAfter(limit);
}

/**
 * Tests whether the game ID is contains all digits and doesn't match any of the
 * provided invalid IDs.
 */
function isValidId(invalidIds) {
  return game => !invalidIds.includes(game.id) && /^\d+$/.test(game.id);
}

/**
 * Formats the game data for storage, keeping only necessary data.
 */
function formatForStorage() {
  return game => ({
    id: game.id,
    liveThreadEligible: game.liveThreadEligible,
    liveThreadId: null,
    start: game.startTimeMoment.toISOString(),
    state: game.gameState.toLowerCase(),
  });
}
