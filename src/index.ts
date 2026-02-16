import { AtpAgent, BlobRef, RichText } from "@atproto/api";
import * as dotenv from 'dotenv';

const RECENT_URL = 'https://images-assets.nasa.gov/recent.json';

dotenv.config({quiet: true});

// Create a Bluesky Agent 
const agent = new AtpAgent({
    service: 'https://bsky.social',
})

function find_original(collection: [string]) {
    const url = collection.find((link) => link.includes('~orig'));
    if (url) { return url; }
    return collection[0];
}

function find_thumbnail(collection: [string]) {
    var url = collection.find((link) => link.includes('~thumb.jpg'));
    if (url) { return url; }
    url = collection.find((link) => link.endsWith('.jpg'));
    if (url) { return url; }
    return collection[0];
}

class BadImage extends Error { }

async function get_image(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    var size = parseInt(response.headers.get('content-length')!);
    var content_type = response.headers.get('content-type')!;
    if (!content_type.startsWith('image') || size > 1_000_000) {
        throw new BadImage();
    }
    const {data} = await agent.uploadBlob(await response.blob(), {encoding: content_type });
    return data.blob;
}

async function get_image_data(chosen: string, collection: [string]) {
    var i = 0;
    var image_data = undefined;
    while (!image_data && i < collection.length) {
        try {
            image_data = await get_image(chosen);
        } catch (e) {
            if (!(e instanceof BadImage)) { throw e; }
            chosen = collection[i++];
        }
    }
    return image_data;
}

async function get_post_data(
        { media, title, nasaid, collection }:
            { media: string; title: string; nasaid: string; collection: [string]; }
        ) : Promise<[BlobRef, RichText]>
    {
    var image_data = undefined;
    var text = undefined;
    switch (media) {
        case 'image': {
            image_data = await get_image_data(find_original(collection), collection);
            text = new RichText({
                text: `${title}\n\nhttps://images.nasa.gov/details/${nasaid}`,
            });
            text.detectFacets(agent);
            return [image_data!, text];
        }
        case 'video': {
            image_data = await get_image_data(find_thumbnail(collection), collection)!;
            text = new RichText({
                text: `${title}\n\nhttps://images.nasa.gov/details/${nasaid}`,
            });
            text.detectFacets(agent);
            return [image_data!, text];
        }
        default:
                throw new Error(`Unknown media type: ${media}`);
    }
}

async function get_asset() {
    // Get the recent assets
    const response = await fetch(RECENT_URL)
    if (!response.ok) {
        throw new Error(`Failed to fetch recent assets: ${response.statusText}`);
    }
    const value = await response.json();
    // Pick one
    const links = value['collection']['items'];
    var choice = undefined;
    do {
        // Skip audio for now
        var id = Math.floor(Math.random() * links.length);
        choice = links[id];
    } while (choice['data'][0]['media_type'] === 'audio');
    return choice;
}

async function get_post(metadata: Map<string,string>, collection: [string]) {
    const media = metadata.get('media_type')!;
    const nasaid = metadata.get('nasa_id');
    const title = metadata.get('title');
    const description = metadata.get('description');
    if (!nasaid || !title || !description) {
        throw new Error('Missing nasa_id, title, or description in data');
    }
    const [image_data, text] = await get_post_data({ media, title, nasaid, collection });
    await agent.post({
        $type: 'app.bsky.feed.post',
        text: text.text,
        facets: text.facets,
        createdAt: new Date().toISOString(),
        embed: {
            $type:'app.bsky.embed.images', 
            images:[{
                alt: description, 
                image: image_data!,
            }]
        },
    });

}

async function main() {
    const asset = await get_asset();
    // Get the collection
    const response = await fetch(asset['href']);
    if (!response.ok) {
        throw new Error(`Failed to fetch collection: ${response.statusText}`);
    }
    const collection = await response.json();

    await agent.login({
        identifier: process.env.BLUESKY_USERNAME!,
        password: process.env.BLUESKY_PASSWORD!
    })
    const post = await get_post(new Map(Object.entries(asset['data'][0])), collection);
    console.log("Just posted!");
}

main().catch(console.error);