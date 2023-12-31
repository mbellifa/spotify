const clientId = '535006dca0a6470886de000ba3080671';
const redirectUri = 'https://mbellifa.github.io/spotify/';


const { createApp, ref, getCurrentInstance } = Vue;

async function getProfile(accessToken) {

    const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
            Authorization: 'Bearer ' + accessToken
        }
    });

    const data = await response.json();
    return data;
}

async function getTopTracks(accessToken) {

    const response = await fetch('https://api.spotify.com/v1/me/top/tracks', {
        headers: {
            Authorization: 'Bearer ' + accessToken
        }
    });

    const data = await response.json();
    return data;
}
async function getRecommendedTracks(accessToken, trackId) {
    const response = await fetch('https://api.spotify.com/v1/recommendations?' + new URLSearchParams({'seed_tracks':trackId}), {
        headers: {
            Authorization: 'Bearer ' + accessToken
        }
    });

    const data = await response.json();
    return data;
}
function trackObjToName(trackObj) {
    return trackObj.artists.map(artist => artist.name).join(', ') + ' - ' + trackObj.name;

}

function accessTokenReady(instance) {
    let accessToken = localStorage.getItem('access_token');
    if (accessToken) {
        getProfile(accessToken).then(data => console.log(data));
        getTopTracks(accessToken).then(data => {
            instance.topTracks = data.items;
            for (let i=0;i < instance.topTracks.length; i++) {
                setTimeout(() => {
                    getRecommendedTracks(accessToken, instance.topTracks[i].id).then(data => {
                        data.tracks.forEach(track => {
                            instance.recommendedTracks[track.id] = (instance.recommendedTracks[track.id] || 0) + 1;
                            instance.trackIdLookup[track.id] = trackObjToName(track);
                        })
                    });
                }, i * 1000);
            }
        });

    }

}
createApp({
    setup() {
        const topTracks = ref([]);
        const authorized = ref(false);
        const recommendedTracks = ref({});
        const trackIdLookup = ref({});
        function authorizeApp() {
            generateCodeChallenge(codeVerifier).then(codeChallenge => {
                let state = generateRandomString(16);
                let scope = 'user-read-private user-read-email user-top-read';

                localStorage.setItem('code_verifier', codeVerifier);

                let args = new URLSearchParams({
                    response_type: 'code',
                    client_id: clientId,
                    scope: scope,
                    redirect_uri: redirectUri,
                    state: state,
                    code_challenge_method: 'S256',
                    code_challenge: codeChallenge
                });

                window.location = 'https://accounts.spotify.com/authorize?' + args;
            });
        }
        return {
            authorized,
            topTracks,
            authorizeApp,
            recommendedTracks,
            trackIdLookup
        }
    },
    mounted() {
        const urlParams = new URLSearchParams(window.location.search);
        let code = urlParams.get('code');
        if (code) {
            this.authorized = true;
            let codeVerifier = localStorage.getItem('code_verifier');

            let body = new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri,
                client_id: clientId,
                code_verifier: codeVerifier
            });
            const response = fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('HTTP status ' + response.status);
                    }
                    return response.json();
                })
                .then(data => {
                    localStorage.setItem('access_token', data.access_token);
                    accessTokenReady(this);
                })
                .catch(error => {
                    console.error('Error:', error);
                });
        }
        accessTokenReady(this);
        console.log("mounted!");
    }
}).mount('#app')


function generateRandomString(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
let codeVerifier = generateRandomString(128);
async function generateCodeChallenge(codeVerifier) {
    function base64encode(string) {
        return btoa(String.fromCharCode.apply(null, new Uint8Array(string)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);

    return base64encode(digest);
}