# nasaimages-bot
A Bluesky/ATproto bot to post assets from images.nasa.gov

## Usage

From cron (see crontab file), run `npm run start`.

The script will
1. Fetch the recent.json file,
2. Pick one asset (image, video, or audio (audio is not currently supported
   (I need to look up an example))),
3. Get the collection of URLs for the asset,
4. Format and post a skeet to Bluesky, containing the asset title, the 
   original image (for images) or a thumbnail (for videos) with the asset's
   description as the Alt-text, and a link to the asset's page.

## Configuration

You need a .env file in the current directory, of the format:

```
BLUESKY_USERNAME=nasa-images-bot@crsr.net
BLUESKY_PASSWORD=<app password>
```

Good luck!