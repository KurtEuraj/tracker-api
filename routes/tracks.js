const express = require("express")
const router = express.Router()
require("dotenv").config()
const axios = require("axios")
const OpenAI = require("openai")

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const formatSingle = `1. "Song Name" by Artist Name`

let accessToken = ""
let tokenExpiry = ""

const getAccessToken = async () => {
    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: {
            'Authorization': 'Basic ' + (new Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'))
        },
        data: "grant_type=client_credentials",
    };

    try {
        const response = await axios.post(authOptions.url, authOptions.data, { headers: authOptions.headers });
        if (response.status === 200) {
            accessToken = response.data.access_token;
            tokenExpiry = Date.now() + 3600000;
        }
    } catch (error) {
        console.log(`Error obtaining Access Token ${error}`)
    }
}

const checkAccessToken = async () => {
    if (tokenExpiry <= Date.now()) {
        await getAccessToken()
    }
}

router.post("/", async (req, res) => {
    await checkAccessToken()

    let songTitle = ""
    let songId = undefined
    let missedSongs = []

    while (songId === undefined) {
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
                { "role": "system", "content": "You are very knowledgeable about music" },
                { "role": "system", "content": "You reply only with the song name and artists" },
                { "role": "system", "content": "You don't reply with the same song that is inputted" },
                { "role": "system", "content": `You never reply with these songs: ${req.body.history}` },
                { "role": "system", "content": `You never reply with these songs: ${missedSongs}` },
                { "role": "system", "content": "The songs you give back must be available on Spotify" },
                { "role": "system", "content": `You reply only with this format ${formatSingle}` },
                { "role": "user", "content": "I am going to ask for song recommendations based on my favorite song. Don't give me the same artist" },
                { "role": "user", "content": `Give me 1 song like ${req.body.song}` }]
        });

        const gptSong = completion.choices[0].message.content
        const parts = gptSong.split('" by ');
        const songNameStr = parts[0].replace(/^\d+\.\s+\"/, '');
        const songName = songNameStr.replaceAll(" ", "+")
        const artist = parts[1].replaceAll(" ", "+");
        const songItem = { song: songName, artist: artist };

        try {
            const response = await axios.get(`https://api.spotify.com/v1/search?q=${songItem.song}+${songItem.artist}&type=track`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    }
                })
            for (const track of response.data.tracks.items) {
                if (track.name.toLowerCase().replaceAll(" ", "").includes(songItem.song.toLowerCase().replaceAll("+", "")) && (songItem.artist.toLowerCase().replaceAll("+", " ").includes(track.artists[0].name.toLowerCase()))) {
                    songId = track.id
                    songTitle = songItem.song.replaceAll("+", " ")
                }
            }
            if (songId === undefined) {
                missedSongs.push(gptSong)
            }
        } catch (error) {
            res.status(500).json({
                message: `Error getting song data ${error}`,
            });
        }
    }
    const song = {
        songId: songId,
        songName: songTitle
    }
    res.json(song)
})

router.post("/search", async (req, res) => {
    await checkAccessToken()

    try {
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
    } catch (error) {
        res.status(500).json({
            message: `Error getting song data ${error}`,
        });
    }
})

module.exports = router