// follow modules loaded via `npm i --save request cheerio`
/*jshint esversion: 6 */
const request = require('request');
const http = require('http');
const url = require('url');
const ICONERROR   = 'a5106';
let tokenTimeStart = new Date();


const calcDST = function() {
  let   dateAdustedObj = new Date(new Date().toLocaleString('en', {timeZone: 'Europe/Stockholm'}));
  const dateDate = dateAdustedObj.getUTCFullYear() + '-' + ( dateAdustedObj.getMonth() + 1 + '' ).padStart(2, '0') + '-' + (dateAdustedObj.getDate() + '').padStart(2, '0');
  const dateTime = ((dateAdustedObj.getUTCHours()) + '').padStart(2, '0') + ':' + (dateAdustedObj.getMinutes() + '').padStart(2,'0');
    
  return {
    obj: dateAdustedObj,
    date: dateDate,
    time: dateTime,
  };
};

function getDueTimes(token,req) {
  
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
  
  const dateAdustedObj = calcDST(); 
  
  // we're returning a promise so we can later reuse in
  // a web server
  return new Promise((resolve, reject) => {
    
    // if the last daylight savings milestine in the config was over 6months old - report
    if (dateAdustedObj === 'no-daylight-dates') {
      const dataOut = { 
        'frames': {
          'icon': ICONERROR,
          'text': 'No daylight savings config for at least 6 months - update server code!'
        } 
      };
      return reject(dataOut);
    }  
    
    const apiUrl = APIURL + '?id=' + STOPID + '&date=' + dateAdustedObj.date + '&time=' + dateAdustedObj.time + '&format=json';
    
    console.log('apiUrl',apiUrl)
    
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
      
      // sort departures with earliest departures first
      departures.sort((a, b) => {
        const timeA = a.time.toUpperCase(); // ignore upper and lowercase
        const timeB = b.time.toUpperCase(); // ignore upper and lowercase
        if (timeA < timeB) {
          return -1;
        }
        if (timeA > timeB) {
          return 1;
        }
        return 0;
      });
      
      //console.log('departures',departures[2])
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
          const departureDateWaitMs = departureDateObj.getTime() - dateAdustedObj.obj.getTime(); // note the UTC/CET adjustment
          //console.log(departure.rtTime, departureDateWaitMs/1000/60)
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
          'text': 'no departures found for id=' + STOPID + '&date=' + dateAdustedObj.date + '&time=' + dateAdustedObj.time
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
        'time': dateAdustedObj,
        'adjusteddate': dateAdustedObj.date,
        'adjustedtime': dateAdustedObj.time,
        'adjustedBy': dateAdustedObj.daylightAdj,
        'lastDaylightAdjustment': dateAdustedObj.daylightDate,
        'url': apiUrl,
        //'departures': departures,
        'departuresLength': departures.length,
        'frames': frames 
      };
      resolve(dataOut);
    });
  });
}

http.createServer((req, res) => {
  getOauth2(req).then(token => {
    //console.log('***',getDueTimes(token,req))
    getDueTimes(token,req).then(data => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(data));
    }).catch(error => {
      console.error('ERROR1');
      console.error(error);
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify( error ));
    });
  }).catch(error => {
    console.error('ERROR2');
    console.error(error);
    const data = {
      frames : [{
        'icon': ICONERROR,
        'text': 'OAuth2 error: ' + error,
        'time': calcDST()
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
      const KEYSECRET64 = new Buffer.from(KEY + ':' + SECRET).toString('base64');
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