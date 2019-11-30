# game-thread

Containerized Node.js scripts that check NCAA api for new games and create game
threads for them when needed.

## Usage

Build the image.
  
```shell script
docker build -t allhail/game-thread:local .
```

Run the `check` command.
  
```shell script
docker run --name allhail_game-thread_check \
           --env-file .env \
           --volume /var/opt/allhail/game-thread:/var/opt/app \
           --rm \
           allhail/game-thread:local check
```

Run the `process` command.

```shell script
docker run --name allhail_game-thread_process \
           --env-file .env \
           --volume /var/opt/allhail/game-thread:/var/opt/app \
           --rm \
           allhail/game-thread:latest process
```

For more readable output, filter the output through the `pino-pretty` package.

```shell script
docker run ... | npx pino-pretty
```

## Environment variables

- **LOG_LEVEL**  
Determines the severity of data logged. Possible values are "error", "warn",
"info", "debug", and "trace".
- **DATA_DIR**  
The location where game data should be stored within the container.
In production containers, should always be `/var/opt/app`.
- **REDDIT_CLIENT_ID**  
The client ID provided by Reddit for your application.
- **REDDIT_CLIENT_SECRET**  
The client secret provided by Reddit for your application.
- **REDDIT_PASSWORD**  
The password of the Reddit account that will create the new submission.
- **REDDIT_SUBREDDIT**  
The name of the subreddit where the new submission will be made. Should not
include any prefix. E.g. "AllHail".
- **REDDIT_USERNAME**  
The username of the Reddit account that will create the new submission.
