const express = require("express")
const app = express()
const cors = require("cors")
require("dotenv").config()
const PORT = process.env.PORT || 8080
const tracksRoute = require("./routes/tracks")

app.use(cors())

app.use(express.json())

app.use("/api/tracks", tracksRoute)

app.get('/', (req, res) => {
    res.send(`<h1>Welcome to the Tracker Backend API</h1>`);
});


app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`)
})