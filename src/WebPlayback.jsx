import React, { useState, useEffect } from 'react';
import './WebPlayback.css';
import { get } from 'request';

const track = {
    name: "",
    album: {
        images: [
            { url: "" }
        ],
        release_date: "",
        name: "",
        release_date_precision: ""
    },
    artists: [
        { name: "" }
    ]
}

function WebPlayback(props) {

    const [is_paused, setPaused] = useState(false);
    const [is_active, setActive] = useState(false);
    const [player, setPlayer] = useState(undefined);
    const [current_track, setTrack] = useState(track);
    const [randomNumbers, setRandomNumbers] = useState([]);
    const [albumMetadata, setAlbumMetadata] = useState({});
    const [lyrics, setLyrics] = useState("");
    const [geniusAccessToken, setGeniusAccessToken] = useState("");

    useEffect(() => {

        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;

        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {

            const player = new window.Spotify.Player({
                name: 'Web Playback SDK',
                getOAuthToken: cb => { cb(props.token); },
                volume: 0.5
            });

            setPlayer(player);

            player.addListener('ready', ({ device_id }) => {
                console.log('Ready with Device ID', device_id);
                setActive(true); // Set is_active to true when the player is ready
                player._options.id = device_id; // Automatically select the current device

                // Send PUT request to make the web playback sdk the current device
                fetch('https://api.spotify.com/v1/me/player', {
                    method: 'PUT',
                    headers: {
                        'Authorization': 'Bearer ' + props.token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        device_ids: [device_id],
                        //play: true
                    })
                })
                    .then(response => {
                        if (response.ok) {
                            console.log('Web Playback SDK is now the current playback device');
                        } else {
                            console.log('Failed to make Web Playback SDK the current playback device');
                        }
                    })
                    .catch(error => {
                        console.log('Error making request to make Web Playback SDK the current playback device:', error);
                    });
            });

            player.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
                setActive(false); // Set is_active to false when the player is not ready
            });

            player.addListener('player_state_changed', (state => {

                if (!state) {
                    return;
                }

                setTrack(state.track_window.current_track);
                setPaused(state.paused);

                player.getCurrentState().then(state => {
                    (!state) ? setActive(false) : setActive(true)
                });

                const albumUri = state.track_window.current_track.album.uri;
                const albumId = albumUri.split(':')[2];
                fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer ' + props.token,
                        'Content-Type': 'application/json'
                    }
                })
                    .then(response => response.json())
                    .then(data => {
                        setAlbumMetadata(data);
                    })
                    .catch(error => {
                        console.log('Error retrieving album metadata:', error);
                    });


            }));

            player.connect();

        };
    }, []);

    const generateRandomNumbers = () => {
        const randomNumber1 = Math.floor(Math.random() * 6) + 1;
        const randomNumber2 = Math.floor(Math.random() * 6) + 1;
        const randomNumber3 = Math.floor(Math.random() * 6) + 1;
        const randomNumber4 = Math.floor(Math.random() * 6);

        const categories = ["Song Name", "Band Name", "Release Year", "First Lyric", "Last Lyric", "Run the Table"];

        const randomNumbers = [
            { title: "Skips", value: randomNumber1 },
            { title: "Seconds of playback", value: randomNumber2 },
            { title: "Points", value: randomNumber3 },
            { title: "Category", value: categories[randomNumber4] }
        ];

        setRandomNumbers(randomNumbers);
        setLyrics(""); // Clear the value for lyrics

        player.nextTrack();

        setTimeout(() => {
            player.pause();
        }, (randomNumber2 + 2) * 1000);


};

const getLyrics = () => {
    const artistName = current_track.artists[0].name.replace(/ /g, "-");
    const songTitle = current_track.name.replace(/ /g, "-");
    console.log(artistName, songTitle);
    fetch(`https://api.openai.com/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + process.env.REACT_APP_OPENAI_KEY
        },
        body: JSON.stringify({
            messages: [
                { role: 'user', content: `What are the first and last lyrics to the song "${songTitle}" by "${artistName}"? Format the response to just include First Lyric and Last Lyric.` }
            ],
            max_tokens: 100,
            model: 'gpt-3.5-turbo'
        })
    })
        .then(response => response.json())
        .then(data => {
            console.log(data);
            setLyrics(data.choices[0].message.content);
        })
        .catch(error => {
            console.log('Error retrieving lyrics:', error);
        });
    };

const replayCurrentSong = () => {
    player.seek(0);
    player.togglePlay();
    setTimeout(() => {
        player.pause();
    }, (randomNumbers[1].value + 1) * 1000);
};

if (!is_active) {
    return (
        <div className="container">
            <div className="main-wrapper">
                <label>Spotify is not Active...</label>
                {randomNumbers.map((number, index) => (
                    <div key={index} className="random-number">
                        <div className="random-number__title">{number.title}: {number.value}</div>
                    </div>
                ))}
                <b> Go to your Spotify App and change Playback to Web Playback </b>
            </div>
        </div>
    );
} else {
    return (
        <div className="container">
            <div className="main-wrapper">
                <h1>PlayListen</h1>
                <button className="btn-spotify" onClick={generateRandomNumbers}>
                    ROLL THE DICE
                </button>
                {randomNumbers.map((number, index) => (
                    <div key={index} className="random-number">
                        <div className="random-number__title">{number.title}: {number.value}</div>

                    </div>
                ))}

                <h2>Answer Key</h2>
                <div className="now-playing__side">

                <div className="now-playing__artist">ARTIST: {current_track.artists[0].name}</div>
                    <div className="now-playing__name">SONG: {current_track.name}</div>
                    <div className="now-playing__album">ALBUM: {current_track.album.name}</div>
                    <div className="now-playing__year">YEAR: {albumMetadata.release_date}</div>
                    {lyrics && (
                        <div className="lyrics">Lyrics: {lyrics}</div>
      )} 
                    <button className="btn-spotify" onClick={() => { getLyrics() }}>
                            GET LYRICS
                        </button><br></br><br></br>


                    <button className="btn-spotify" onClick={() => { player.previousTrack() }} >
                        &lt;&lt;
                    </button>

                    <button className="btn-spotify" onClick={() => { player.togglePlay() }} >
                        {is_paused ? "PLAY" : "||"}
                    </button>

                    <button className="btn-spotify" onClick={() => { replayCurrentSong() }} >
                        REPLAY
                    </button>

                    <button className="btn-spotify" onClick={() => { player.nextTrack() }} >
                        &gt;&gt;
                    </button>
                </div>
                <br></br>
                <img src={current_track.album.images[0].url} className="now-playing__cover" alt="" />

            </div>
        </div>  
    );
}
}

export default WebPlayback;
