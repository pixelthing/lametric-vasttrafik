// follow modules loaded via `npm i --save request cheerio`
/*jshint esversion: 6 */
const request = require('request');
const http = require('http');
const url = require('url');
const ICONERROR   = 'a5106';
let tokenTimeStart = new Date();

http.createServer((req, res) => {
  getOauth2(req).then(token => {
    getDueTimes(token,req).then(data => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(data));
    }).catch(error => {
      console.error('ERROR1');
      console.error(error);
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify( 'ERROR1' + error ));
    });
  }).catch(error => {
    console.error('ERROR2');
    console.error(error);
    const data = {
      frames : [{
        'icon': ICONERROR,
        'text': 'OAuth2 key failure'
      }]
    };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(data));
  });
}).listen(3000);

function getOauth2(req) {
  
  let accessToken = "";
  let tokenMaxAge = 3000;
  let KEY = false;                                                        // VÄSTTRAFIK APP API KEY (in URL arg)
  let SECRET = false;                                                     // VÄSTTRAFIK APP API SECRET (in URL arg)
  const tokenTimeNow = new Date();
  
  // get the OAuth2 key and secret from url arguments
  const urlQuery = url.parse(req.url,true).query;
  if (urlQuery.key)
    KEY    = urlQuery.key;
  if (urlQuery.secret)
    SECRET    = urlQuery.secret;
  
  return new Promise((resolve, reject) => {
    if (!accessToken.length || ((tokenTimeNow - tokenTimeStart)/1000 ) > tokenMaxAge) {
      
      if (!KEY.length || !SECRET.length) {
        reject('no data recieved. Possibly token expired.');
      }
      const KEYSECRET64 = new Buffer(KEY + ':' + SECRET).toString('base64');
      const OAUTHURL    = "https://api.vasttrafik.se:443/token";          // VÄSTTRAFIK OAUTH2 TOKEN REQUEST
      const SCOPE       = "LAMETRICNODESERVER4";                          // VÄSTTRAFIK APP "SCOPE" - just a random name of the client.
      
      request({
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + KEYSECRET64,
        },
        body: 'grant_type=client_credentials&scope=' + SCOPE,
        url: OAUTHURL
      }, (error, res, body) => {
        if (error || body.error) {
          const dataOut = { 'frames': [
            {
              'icon': ICONERROR,
              'text': error || body.error
            }
          ]};
          return reject(dataOut);
        }
        
        const dataIn = JSON.parse(body);
        const tokenScope = dataIn.scope;
        const tokenBearer = dataIn.token_type;
        const epiresIn = dataIn.expires_in;
        const accessToken = dataIn.access_token;
        
        resolve(accessToken);
      });
    } else {
      resolve(accessToken);
    }
  });
  
}


function getDueTimes(token,req) {
  // we're returning a promise so we can later reuse in
  // a web server
  
  const APIURL      = 'https://api.vasttrafik.se/bin/rest.exe/v2/departureBoard';
  let   DIRECTION   = true;                       // which tracks to select. true = TRACK, false = TRACKALT
  let   STOPID      = '9021014004230000';         // your stop id (eg Käringberget = '9021014004230000')
  let   TRACK       = ['A','C'];                  // the stops (and therefore the directions) you're interested in.
  let   TRACKALT    = ['B','D'];                  // the stops (and therefore the directions) you're interested in.
  let   FRAMESMAX   = 3;                          // max frames to display
  let   MINTIME     = 3;                          // minumum time it takes to get to the tramstop. Ignore all departures less than this.
  const TOMORROW    = 180;                        // how many minutes away does a tram need to be from the current time to qualify not running tonight?
  const ICONTRAMOLD = 'a5101';
  const ICONTRAMNEW = 'a5244';
  const ICONBUS     = 'a5102';
  let   UTCPLUS     =  1;            
  
  const calcDST = function() {
    const dates = [
      {
        time : '2017-03-27T02:00:00',
        utcplus: UTCPLUS + 1
      },
      {
        time : '2017-10-29T03:00:00',
        utcplus: UTCPLUS
      },
      {
        time : '2018-03-25T02:00:00',
        utcplus: UTCPLUS + 1
      },
      {
        time : '2018-10-28T03:00:00',
        utcplus: UTCPLUS
      },
      {
        time : '2019-03-31T02:00:00',
        utcplus: UTCPLUS + 1
      },
      {
        time : '2019-10-27T03:00:00',
        utcplus: UTCPLUS
      },
      {
        time : '2020-03-29T02:00:00',
        utcplus: UTCPLUS + 1
      },
      {
        time : '2020-10-25T03:00:00',
        utcplus: UTCPLUS
      }
    ];
    for (let i=0; i<dates.length; i++) {
      if (new Date() > new Date(dates[i].time)) {
        return dates[i].utcplus;
      }
    }
  };
  
  let   SERVERTIMEADJUST = calcDST();  
  
  return new Promise((resolve, reject) => {
    
    const dateObj = new Date();
    let   dateAdustedObj = new Date();
          dateAdustedObj = new Date(dateAdustedObj.setTime(dateObj.getTime() + (SERVERTIMEADJUST*60*60*1000)));
    const dateDate = dateAdustedObj.getUTCFullYear() + '-' + ( dateAdustedObj.getMonth() + 1 ) + '-' + dateAdustedObj.getDate();
    const dateTime = dateAdustedObj.getHours() + '%3A' + dateAdustedObj.getMinutes();
    const apiUrl = APIURL + '?id=' + STOPID + '&date=' + dateDate + '&time=' + dateTime + '&format=json';
    
    // tidy URL QUERY ARGS
    const urlQuery = url.parse(req.url,true).query;
    if (urlQuery.stopid)
      STOPID    = urlQuery.stopid.replace(/\s/g,'');
    if (urlQuery.track)
      TRACK     = urlQuery.track.replace(/\s/g,'').split(',');
    if (urlQuery.trackalt)
      TRACKALT  = urlQuery.trackalt.replace(/\s/g,'').split(',');
    if (urlQuery.framesmax)
      FRAMESMAX = parseInt(urlQuery.framesmax.trim());
    if (urlQuery.mintime)
      MINTIME   = parseInt(urlQuery.mintime.trim());
    if (urlQuery.alt) {
      DIRECTION = false;
      TRACK = TRACKALT;
    }
    
    // make a GET request to get a page of the next due buses
    request({
      headers: {
        'Authorization': 'Bearer ' + token,
      },
      url: apiUrl
    }, (error, res, body) => {
      // if there was something wrong with the request, print it
      // out and exit the function
      if (error || body.error) {
        const dataOut = { 'frames': [
          {
            'icon': ICONERROR,
            'text': error || body.error
          }
        ]};
        return reject(dataOut);
      }
      
      // parse the feed
      const dataIn = JSON.parse(body);
      // if the data is bad, it could be for any number of reasons. Most porbable is the key is wrong
      if (typeof dataIn.DepartureBoard === 'undefined') {
        reject('no data recieved. Possibly token expired.');
      }
      const departures = dataIn.DepartureBoard.Departure;
      let frames = [];
      let k = 0;
      
      //*DEBUG*/ frames.push('departures.length:' + departures.length)
      //*DEBUG*/ frames.push('FRAMESMAX:' + FRAMESMAX)
      
      // loop through all departures sent in the data
      for(let i=0; i<departures.length; i++) {
        // if we've reached the max of the results we need, exit
        
        //*DEBUG*/ frames.push('-------')
        //*DEBUG*/ frames.push('i:' + i)
        //*DEBUG*/ frames.push('k:' + k)
        
        if (k >= FRAMESMAX) {
          break;
        }
        const departure = departures[i];
        // if this departure is on one of the tracks/stops we're looking at. Not we're looking at the scheduled track, not the "realtime" rTrack. That's because if a tram is diverted to the other side of the tracks (eg works), we'll think it's going the other way. Better to rely on the timetabled track to tell us which direction it's going, not the track it's actually going to arrive on.
        
        //*DEBUG*/ frames.push('* FOUND departure.track:' + departure.track)
        //*DEBUG*/ frames.push('* TRACK:' + TRACK.join('|'))
        
        if (TRACK.indexOf(departure.track) >= 0) {
          //*DEBUG*/ frames.push('departure.track found:' + departure.track)
          // calc time of departure, compare to current time (with UTC+1 adjust)
          const departureDateObj = new Date(departure.rtDate + 'T' + departure.rtTime + ':00');
          const departureDateWaitMs = departureDateObj.getTime() - dateAdustedObj.getTime(); // note the UTC/CET adjustment
          const departureDateWaitMins = Math.round(departureDateWaitMs / 1000 / 60);
          //*DEBUG*/ frames.push('* departureDateWaitMins:' + departureDateWaitMins)
          //*DEBUG*/ frames.push('* MINTIME:' + MINTIME)
          // if it's less than the minimum time it would take to get to the stop, ignore it
          if (departureDateWaitMins < MINTIME) {
            //*DEBUG*/ frames.push('* ...continue')
            continue;
          }
          // if the tram/bus is more than X mins away, assume it's tomorrow. Otherwise, print it.
          //const departureDateWaitHuman = (departureDateWaitMins > TOMORROW ? 'TOM' : departureDateWaitMins + 'M' );
          const departureDateWaitHuman = departureDateWaitMins + 'M';
          // choose icon
          let icon = ICONBUS;
          if (departure.type === 'TRAM') {
            icon = ICONTRAMOLD;
            if (departure.accessibility && departure.accessibility==='wheelChair') {
              icon = ICONTRAMNEW;
            }
          }
          // fill a frame
          frames.push({
            'icon': icon,
            'text': departure.sname + (DIRECTION ? '+' : '<' ) + departureDateWaitHuman
          });
          k++;
        } else {
          //*DEBUG*/ frames.push('💩 NOT FOUND departure.track:' + departure.track)
        }
      }
      
      if (!frames.length) {
        frames = {
          'icon': ICONERROR,
          'text': 'no departures found for id=' + STOPID + '&date=' + dateDate + '&time=' + dateTime
        };
      }
      
      //*DEBUG*/ frames.push(dataIn); // add the raw data to the end to allow visual checking
      
      // resolve the promise: specifically, return the times
      const dataOut = { 
        'direction': DIRECTION,
        'stopid': STOPID,
        'track': TRACK,
        'framesmax': FRAMESMAX,
        'mintime': MINTIME,
        'servertime': dateObj,
        'adjustedtime': dateAdustedObj,
        'url': apiUrl,
        //'departures': departures,
        'departuresLength': departures.length,
        'frames': frames 
      };
      resolve(dataOut);
    });
  });
}