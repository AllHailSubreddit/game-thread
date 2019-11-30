const {
  REDDIT_CLIENT_ID,
  REDDIT_CLIENT_SECRET,
  REDDIT_PASSWORD,
  REDDIT_SUBREDDIT,
  REDDIT_USERNAME,
} = process.env;
const {
  name: TASK_NAME,
  version: TASK_VERSION,
  author: AUTHOR,
} = require("../package");

const moment = require("moment-timezone");
const { escape } = require("querystring");
const snoowrap = require("snoowrap");

const EASTERN_TIMEZONE = "America/New_York";
const reddit = new snoowrap({
  userAgent: `nodejs:org.allhail.bot.${TASK_NAME}:v${TASK_VERSION} (by ${AUTHOR})`,
  clientId: REDDIT_CLIENT_ID,
  clientSecret: REDDIT_CLIENT_SECRET,
  username: REDDIT_USERNAME,
  password: REDDIT_PASSWORD,
});
const sportNames = {
  "basketball-men": "Men's Basketball",
  "basketball-women": "Women's Basketball",
  football: "Football",
};

function createBotReportUrl(url) {
  const to = escape(`/r/${REDDIT_SUBREDDIT}`);
  const subject = escape(
    "I have a problem or suggestion regarding /u/AllHail_Bot"
  );
  const message = escape(`
**Problem/Suggestion:** 
**Reference URL**: ${url || ""}`);
  return `https://www.reddit.com/message/compose?to=${to}&subject=${subject}&message=${message}`;
}

async function createLiveThread(ncaaGame) {
  const titleSections = ["[Game Thread]"];
  const isHome = ncaaGame.home.names.seo.toLowerCase() === "louisville";
  const louisville = isHome ? ncaaGame.home : ncaaGame.away;
  const opponent = isHome ? ncaaGame.away : ncaaGame.home;

  const louisvilleTitleSection = [];

  if (ncaaGame.championship.bracketId && louisville.seed) {
    const seed = `${+louisville.seed} seed`;
    louisvilleTitleSection.push(seed);
  } else if (louisville.rank) {
    const rank = `#${+louisville.rank}`;
    louisvilleTitleSection.push(rank);
  }

  const sportName = sportNames[ncaaGame.championship.sport];
  const louisvilleName = `${louisville.names.short} ${sportName}`;
  louisvilleTitleSection.push(louisvilleName);

  const louisvilleRecord = louisville.record;
  louisvilleTitleSection.push(louisvilleRecord);

  const louisvilleTitle = louisvilleTitleSection.join(" ");
  titleSections.push(louisvilleTitle);

  const venue = isHome ? "vs" : "@";
  titleSections.push(venue);

  const opponentTitleSection = [];

  if (ncaaGame.championship.bracketId && opponent.seed) {
    const seed = `${+opponent.seed} seed`;
    opponentTitleSection.push(seed);
  } else if (opponent.rank) {
    const rank = `#${+opponent.rank}`;
    opponentTitleSection.push(rank);
  }

  const opponentName = opponent.names.short;
  opponentTitleSection.push(opponentName);

  const opponentRecord = opponent.record;
  opponentTitleSection.push(opponentRecord);

  const opponentTitle = opponentTitleSection.join(" ");
  titleSections.push(opponentTitle);

  const formattedStartTime = moment
    .unix(ncaaGame.status.startTimeEpoch)
    .tz(EASTERN_TIMEZONE)
    .format("h:mm A z");
  const gameTime = `at ${formattedStartTime}`;
  titleSections.push(gameTime);

  const title = titleSections.join(" ");
  const submission = await reddit
    .submitSelfpost({
      subredditName: REDDIT_SUBREDDIT,
      title,
      sendReplies: false,
    })
    .fetch();

  const location = `${ncaaGame.venue.name}, ${ncaaGame.venue.city}, ${ncaaGame.venue.state}`;
  const botReportUrl = createBotReportUrl(submission.url);
  const body = `
**Opponent:** ${opponentTitle}

**Time:** ${formattedStartTime}

**Location:** ${location}

---

_I am a bot. If you notice a problem or have a suggestion regarding me, please [message the moderators](${botReportUrl})._
`;
  await submission.edit(body);

  await submission.distinguish();
  await submission.setSuggestedSort("new");

  const flairTemplates = await submission.getLinkFlairTemplates();
  const relevantFlair = flairTemplates.find(
    ({ flair_text }) => flair_text === sportName
  );
  if (relevantFlair) {
    await submission.selectFlair({
      flair_template_id: relevantFlair.flair_template_id,
    });
  }

  return submission;
}

async function createSummaryThread(ncaaGame) {
  const titleSections = [];
  const isHome = ncaaGame.home.names.seo.toLowerCase() === "louisville";
  const louisville = isHome ? ncaaGame.home : ncaaGame.away;
  const opponent = isHome ? ncaaGame.away : ncaaGame.home;
  const winner = ncaaGame[ncaaGame.status.winner];
  const isWin = winner === louisville;
  const isTie = !winner;

  // build the title section before the first comma
  const firstTitleSection = ["[Post-Game Thread]"];

  const louisvilleTitleSection = [];

  if (ncaaGame.championship.bracketId && louisville.seed) {
    const seed = `${+louisville.seed} seed`;
    louisvilleTitleSection.push(seed);
  } else if (louisville.rank) {
    const rank = `#${+louisville.rank}`;
    louisvilleTitleSection.push(rank);
  }

  const sportName = sportNames[ncaaGame.championship.sport];
  const louisvilleName = `${louisville.names.short} ${sportName}`;
  louisvilleTitleSection.push(louisvilleName);

  const louisvilleTitle = louisvilleTitleSection.join(" ");
  firstTitleSection.push(louisvilleTitle);

  if (isTie) {
    firstTitleSection.push("ties");
  } else if (isWin) {
    firstTitleSection.push("defeats");
  } else {
    firstTitleSection.push("loses to");
  }

  const opponentTitleSection = [];

  if (ncaaGame.championship.bracketId && opponent.seed) {
    const seed = `${+opponent.seed} seed`;
    opponentTitleSection.push(seed);
  } else if (opponent.rank) {
    const rank = `#${+opponent.rank}`;
    opponentTitleSection.push(rank);
  }

  const opponentName = opponent.names.short;
  opponentTitleSection.push(opponentName);

  const opponentTitle = opponentTitleSection.join(" ");
  firstTitleSection.push(opponentTitle);
  titleSections.push(firstTitleSection.join(" "));

  // build the title section after the first comma
  const secondTitleSection = [`${louisville.score}-${opponent.score}`];

  const lastLinescore = ncaaGame.linescores[ncaaGame.linescores.length - 1];
  const overtime = lastLinescore && /OT$/.test(lastLinescore.per);
  if (overtime) {
    secondTitleSection.push(`(${lastLinescore.per})`);
  }

  titleSections.push(secondTitleSection.join(" "));

  // create the submission
  const title = titleSections.join(", ");
  const submission = await reddit
    .submitSelfpost({
      subredditName: REDDIT_SUBREDDIT,
      title,
      sendReplies: false,
    })
    .fetch();

  // edit the body of the submission to we're able to include the submission URL
  // when needed
  const boxscoreUrl = `https://www.ncaa.com/game/${ncaaGame.id}/boxscore`;
  const botReportUrl = createBotReportUrl(submission.url);
  const scoring = [
    [
      "Team",
      ...ncaaGame.linescores.map(linescore => linescore.per),
      "Total",
    ].join(" | "),
    [":--", ...ncaaGame.linescores.map(() => ":-:"), ":-:"].join(" | "),
    ...[louisville, opponent].map(team => {
      const abbr = ncaaGame.home === team ? "h" : "v";
      return [
        team.names.short,
        ...ncaaGame.linescores.map(linescore => linescore[abbr]),
        ncaaGame.linescores.reduce(
          (total, linescore) => total + +linescore[abbr],
          0
        ),
      ].join(" | ");
    }),
  ].join("\n");
  const body = `
### Scoring

${scoring}

[View the Boxscore on NCAA.com](${boxscoreUrl})

---

_I am a bot. If you notice a problem or have a suggestion regarding me, please [message the moderators](${botReportUrl})._
`;
  await submission.edit(body);

  await submission.distinguish();

  const flairTemplates = await submission.getLinkFlairTemplates();
  const relevantFlair = flairTemplates.find(
    ({ flair_text }) => flair_text === sportName
  );
  if (relevantFlair) {
    await submission.selectFlair({
      flair_template_id: relevantFlair.flair_template_id,
    });
  }

  return submission;
}

async function lockLiveThread(liveThreadId, summaryThreadUrl) {
  const submission = await reddit.getSubmission(liveThreadId);
  const comment = await submission.reply(
    `**This game has ended.** Keep the discussion going in the [post-game thread](${summaryThreadUrl})!`
  );
  await comment.distinguish({ status: true, sticky: true });
  await comment.disableInboxReplies();
  await submission.lock();
  return submission;
}

module.exports = {
  createLiveThread,
  createSummaryThread,
  lockLiveThread,
};
