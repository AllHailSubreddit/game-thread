const { name: TASK_NAME, version: TASK_VERSION } = require("../package");

const axios = require("axios");
const client = axios.create({
  baseURL: "https://data.ncaa.com/casablanca",
  headers: {
    "User-Agent": `org.allhail.bot.${TASK_NAME}/${TASK_VERSION}`,
  },
  timeout: 5000,
});
const sports = [
  ["basketball-men", "d1"],
  ["basketball-women", "d1"],
  ["football", "fbs"],
];

async function get(path) {
  const response = await client.get(path);
  return response.data;
}

function getToday(sport, division) {
  return get(`/schedule/${sport}/${division}/today.json`);
}

function getScoreboard(sport, division, date) {
  return get(`/scoreboard/${sport}/${division}/${date}/scoreboard.json`);
}

async function getScoreboardForToday(sport, division) {
  const { today } = await getToday(sport, division);
  return getScoreboard(sport, division, today);
}

function getAllScoreboardsForToday() {
  return Promise.all(sports.map(args => getScoreboardForToday(...args)));
}

function getGameInfoById(id) {
  return get(`/game/${id}/gameInfo.json`);
}

function getBoxscoreById(id) {
  return get(`/game/${id}/boxscore.json`);
}

module.exports = {
  get,
  getToday,
  getScoreboard,
  getScoreboardForToday,
  getAllScoreboardsForToday,
  getGameInfoById,
  getBoxscoreById,
};
