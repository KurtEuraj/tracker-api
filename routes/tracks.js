const express = require("express")
const router = express.Router()
require("dotenv").config()
const PORT = process.env.PORT || 8080
const request = require("request")
const axios = require("axios")
const OpenAI = require("openai")

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const format = `1. "Song Name" by Artist Name 
2. "Song Name" by Artist Name 
3. "Song Name" by Artist Name 
4. "Song Name" by Artist Name 
5. "Song Name" by Artist Name 
6. "Song Name" by Artist Name`

let accessToken = ""
let tokenExpiry = ""

const getAccessToken = async () => {
    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: {
            'Authorization': 'Basic ' + (new Buffer.from(process.env.OPENAI_CLIENT_ID + ':' + process.env.OPENAI_CLIENT_SECRET).toString('base64'))
        },
        data: "grant_type=client_credentials",
    };

    const response = await axios.post(authOptions.url, authOptions.data, { headers: authOptions.headers });
    if (response.status === 200) {
        accessToken = response.data.access_token;
        tokenExpiry = Date.now() + 3600000;
    }
}

router.post("/", async (req, res) => {
    if (tokenExpiry <= Date.now()) {
        await getAccessToken()
    }

    const songs = []

    const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
            { "role": "system", "content": "You are very knowledgeable about music" },
            { "role": "system", "content": "You reply only with the song name and artists" },
            { "role": "system", "content": `You reply only with this format ${format}` },
            { "role": "user", "content": "I am going to ask for song recommendations based on my favorite song" },
            { "role": "user", "content": `Give me 6 songs like ${req.body.song}` }]
    });

    const gptSongs = completion.choices[0].message.content
    const splitSongs = gptSongs.split('\n')

    splitSongs.forEach((song) => {
        const parts = song.split('" by ');
        const songNameStr = parts[0].replace(/^\d+\.\s+\"/, '');
        const songName = songNameStr.replaceAll(" ", "%25")
        const artist = parts[1].replaceAll(" ", "%25");
        songs.push({ song: songName, artist: artist });
    });

    const allSongsData = await Promise.all(songs.map(async (songItem) => {
        const response = await axios.get(`https://api.spotify.com/v1/search?q=track3A${songItem.song}artist%3A${songItem.artist}&type=track&limit=1`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                }
            })
        return response.data.tracks.items[0].id
    }))
    res.json(allSongsData)
})

router.post("/search", async (req, res) => {
    if (tokenExpiry <= Date.now()) {
        await getAccessToken()
    }

    const response = await axios.get(`https://api.spotify.com/v1/search?q=track3A${req.body.search}&type=track&limit=10`,
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            }
        })
    const allSongs = response.data.tracks.items
    const allSongsData = []
    allSongs.forEach((song) => {
        const songName = song.name
        let artistsArr = []
        let artists = ""
        if (song.artists.length > 1) {
            song.artists.forEach((artist) => {
                artistsArr.push(artist.name)
            })
            artists = artistsArr.join(", ")
        }
        else {
            artists = song.artists[0].name
        }
        const songData = {
            song: songName,
            artists: artists
        }
        allSongsData.push(songData)
    })
    res.json(allSongsData)
})

module.exports = router