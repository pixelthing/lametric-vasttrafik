// follow modules loaded via `npm i --save request cheerio`
/*jshint esversion: 6 */
const request = require('request');
const http = require('http');
const url = require('url');

const ICONERROR   = 'a5106';
let KEY = '_mjaD_SDYTsCdgWs45PnwUQiyy8a';
let SECRET = 'j8mTZVVhLErUIyNtLbA6ZWkNjska';
let tokenTimeStart = new Date();


const getOauth2 = (req) => {
  
  let accessToken = "";
  let tokenMaxAge = 30000;
  const tokenTimeNow = new Date();
  
  // get the OAuth2 key and secret from url arguments (if supplied, they overrule the ones set here)
  const urlQuery = url.parse(req.url,true).query;
  
  return new Promise((resolve, reject) => {
    if (!accessToken.length || ((tokenTimeNow - tokenTimeStart)/1000 ) > tokenMaxAge) {
      
      if (!KEY.length || !SECRET.length) {
        reject('no data recieved. Possibly token expired.');
      }
      const KEYSECRET64 = new Buffer.from(KEY + ':' + SECRET).toString('base64');
      const OAUTHURL   = "https://ext-api.vasttrafik.se/token";          // VÄSTTRAFIK OAUTH2 TOKEN REQUEST
      const SCOPE      = "LAMETRICNODESERVER4";                          // VÄSTTRAFIK APP "SCOPE" - just a random name of the client.
      const payload    = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + KEYSECRET64
        },
        body: 'grant_type=client_credentials',
        url: OAUTHURL
      }
      
      request(payload, (error, res, body) => {
        
        const reply = JSON.parse(body);
        
        // ERROR RESPONSE!!
        if (error || body.error || reply.error) {
          console.error("-----------\nOAUTH ERROR")
          console.error('error:',error)
          console.error('reply.error:',reply.error)
          console.error('reply:',reply)
          const dataOut = { 'frames': [
            {
              'icon': ICONERROR,
              'text': error || reply.error
            }
          ]};
          return reject(dataOut);
        }
      
        
        console.log("-----------\nOAUTH SUCCESS")
        //console.log("OAUTH payload:", reply);
        const tokenScope = reply.scope;
        const tokenBearer = reply.token_type;
        const epiresIn = reply.expires_in;
        const accessToken = reply.access_token;
        
        resolve(accessToken);
      });
    } else {
      resolve(accessToken);
    }
  });
  
}


const getStops = (token,stop) => {
  
  const LOCATIONSAPIURL = 'https://ext-api.vasttrafik.se/pr/v4/locations/by-text';
  const DEPARTURESAPIURL = 'https://ext-api.vasttrafik.se/pr/v4/stop-areas';
  let HTML = '';
  
  return new Promise((resolve, reject) => {
    
    const apiUrl = LOCATIONSAPIURL + `?q=${encodeURIComponent(stop)}&types=stoparea&limit=10&offset=0`;
    
    // make a GET request to get a page of the next due buses
    request({
      headers: {
        'Authorization': 'Bearer ' + token,
      },
      url: apiUrl
    }, (error, res, body) => {
      
      // parse the feed
      const reply = JSON.parse(body);
      
      // ERROR RESPONSE!!!
      if (error || reply.error) {
        console.error("-----------\nLOCATION API ERROR")
        console.error('error:',error)
        console.error('reply.error:',reply.error)
        console.error('reply:',reply)
        console.error('-----------')
        const dataOut = { 'frames': [
          {
            'icon': ICONERROR,
            'text': error || reply.error
          }
        ]};
        return reject(error || reply.error);
      }
      
      
      console.log("-----------\nLOCATION API SUCCESS")
      //console.log("API payload:", reply);
      
      const stopResults = reply.results;
      let stopIds = [];
      stopResults.forEach((i) => {
        stopIds.push({
          gid: i.gid,
          name: i.name
        });
      })
      
      const stopName = stopIds[0].name;
      const stopId = stopIds[0].gid;
      
      HTML += `
      <h1>Sök för "${stop}"</h1>
      <h3>Hittat: "${stopName}"<br />
      Hållplats id: ${stopId}</h3>
      <h3>Spår:</h3>
      `;
  
      resolve(stopIds[0].gid)
    
    });
      
  
  }).then(stopId => {
    
    return new Promise((resolve, reject) => {

      const apiUrl = DEPARTURESAPIURL + '/' + stopId + `/departures?timeSpanInMinutes=240&limit=100&offset=0&includeOccupancy=false`;

      // make a GET request to get a page of the next due buses
      request({
        headers: {
          'Authorization': 'Bearer ' + token,
        },
        url: apiUrl
      }, (error, res, body) => {
        // parse the feed
        const reply = JSON.parse(body);

        // ERROR RESPONSE!!!
        if (error || reply.error) {
          console.error("-----------\nDEPARTURE API ERROR")
          console.error('error:',error)
          console.error('reply.error:',reply.error)
          console.error('reply:',reply)
          console.error('-----------')
          const dataOut = { 'frames': [
            {
              'icon': ICONERROR,
              'text': error || reply.error
            }
          ]};
          return reject(dataOut);
        }


        console.log("-----------\nDEPARTURE API SUCCESS")
        //console.log("API payload:", reply);

        // if the data is bad, it could be for any number of reasons. Most probable is the key is wrong
        if (typeof reply.results === 'undefined') {
          console.log("-----------\nDEPARTURE API EMPTY, CHECK STOP ID?")
          console.log("No reply.results")
          return reject('no data recieved. Check stop ID?');
        }
        const departures = reply.results;
        
        const stops = {};
        
        // parse the stops, lines and destinations at this location
        departures.forEach(departure => {
          
          const stopName = departure.stopPoint.platform;
          const lineName = departure.serviceJourney.line.name;
          const lineDest = departure.serviceJourney.direction.split(',')[0].split(' via')[0];
          
          //console.log('**',stopName,lineName,lineDest)
          
          
          if (!stops[stopName]) {
            stops[stopName] = {
              stopName: stopName,
              lines: {}
            }
            stops[stopName].lines[lineName] = {
              lineName: lineName,
              lineDest: [lineDest]
            }
          } else {
            
            if (!stops[stopName].lines[lineName]) {
              stops[stopName].lines[lineName] = {
                lineName: lineName,
                lineDest: [lineDest]
              }
            } else {
              
              if (stops[stopName].lines[lineName].lineDest.indexOf(lineDest) < 0) {
                stops[stopName].lines[lineName].lineDest.push(lineDest);
              }
            }
          }
          
        });
        
        // loop through the parsed list to create the HTML
        const stopsKeys = Object.keys(stops);
        stopsKeys.sort();
        
        HTML += `<ul>`;
        stopsKeys.forEach(stopKey => {
          const stop = stops[stopKey];
          HTML += `<li><b>${stop.stopName}</b>`;
          const stopsLines = Object.keys(stop.lines);
          stopsLines.sort();
          //if (stopsLines.length > 1) {
            HTML += `<ul>`;
            stopsLines.forEach(stopLineKey => {
              const stopLine = stop.lines[stopLineKey];
              HTML += `<li>${stopLine.lineName} till ${stopLine.lineDest.join(', ')}</li>`;
            });
            HTML += `</ul>`;
          //} else {
          //  HTML += ` (${stop.lines[stopsLines[0]].lineName} till ${stop.lines[stopsLines[0]].lineDest.join(',')})`
          //}
          HTML += `</li>`;
        });
         HTML += `</ul>`;
        
        return resolve(HTML);
        
        
      });
    });
  });
};


const getDueTimes = (token,req) => {

  const APIURL      = 'https://ext-api.vasttrafik.se/pr/v4/stop-areas';
  let   DIRECTION   = true;                       // updated via URL (&alt=true). which tracks to select. true = TRACK, false = TRACKALT
  let   STOPID      = '9021014004230000';         // updated via URL. your stop id (eg Käringberget = '9021014004230000')
  let   TRACK       = ['A','C'];                  // updated via URL. the stops (and therefore the directions) you're interested in.
  let   TRACKALT    = ['B','D'];                  // updated via URL. the stops (and therefore the directions) you're interested in.
  let   FRAMESMAX   = 3;                          // updated via URL. max frames to display
  let   MINTIME     = 3;                          // updated via URL. minumum time it takes to get to the tramstop. Ignore all departures less than this.
  let   DEFICON     = '+';                        // Default stops display, intended to denote direction (eg "<" will result in displaying "11<8M")
  let   ALTICON     = '>';                        // Alternative stops display, intended to denote direction (eg ">" will result in displaying "11>8M")
  const ICONTRAMOLD = 'a5101';
  const ICONTRAMNEW = 'a5244';
  const ICONBUS     = 'a5102';
  
  const dateZulu = new Date();
  const dateZuluISO = dateZulu.getUTCFullYear() 
    + '-' + ( dateZulu.getMonth() + 1 + '' ).padStart(2, '0') 
    + '-' + (dateZulu.getDate() + '').padStart(2, '0')
    + 'T' + ((dateZulu.getUTCHours()) + '').padStart(2, '0') 
    + ':' + (dateZulu.getMinutes() + '').padStart(2,'0')
    + ':00.000Z';
  
  let frames = [];
  
  // we're returning a promise so we can later reuse in
  // a web server
  return new Promise((resolve, reject) => {
    
    const apiUrl = APIURL + '/' + STOPID + `/departures?timeSpanInMinutes=60&maxDeparturesPerLineAndDirection=${FRAMESMAX}&limit=50&offset=0&includeOccupancy=false`;
    
    // tidy URL QUERY ARGS
    const urlQuery = url.parse(req.url,true).query;
    if (urlQuery.stopid && urlQuery.stopid.length)
      STOPID    = urlQuery.stopid.replace(/\s/g,'');
    if (urlQuery.track && urlQuery.track.length)
      TRACK     = urlQuery.track.replace(/\s/g,'').split(',');
    if (urlQuery.trackalt && urlQuery.trackalt.length)
      TRACKALT  = urlQuery.trackalt.replace(/\s/g,'').split(',');
    if (urlQuery.framesmax && urlQuery.framesmax.length)
      FRAMESMAX = parseInt(urlQuery.framesmax.trim());
    if (urlQuery.mintime && urlQuery.mintime.length)
      MINTIME   = parseInt(urlQuery.mintime.trim());
    if (urlQuery.deficon && urlQuery.deficon.length)
      DEFICON   = urlQuery.deficon.trim();
    if (urlQuery.alticon && urlQuery.alticon.length)
      ALTICON   = urlQuery.alticon.trim();
    if (urlQuery.alt) {
      DIRECTION = false;
      TRACK = TRACKALT;
      frames.push({
        'icon': '5108',
        'text': 'ALT DIR'
      });
    }
    
    // make a GET request to get a page of the next due buses
    request({
      headers: {
        'Authorization': 'Bearer ' + token,
      },
      url: apiUrl
    }, (error, res, body) => {
      // parse the feed
      const reply = JSON.parse(body);
      
      // ERROR RESPONSE!!!
      if (error || reply.error) {
        console.error("-----------\nAPI ERROR")
        console.error('error:',error)
        console.error('reply.error:',reply.error)
        console.error('reply:',reply)
        console.error('-----------')
        const dataOut = { 'frames': [
          {
            'icon': ICONERROR,
            'text': error || reply.error
          }
        ]};
        return reject(dataOut);
      }
      
      
      console.log("-----------\nAPI SUCCESS")
      //console.log("API payload:", reply);
      
      // if the data is bad, it could be for any number of reasons. Most probable is the key is wrong
      if (typeof reply.results === 'undefined') {
        console.log("-----------\nAPI EMPTY, CHECK STOP ID?")
        console.log("No reply.results")
        return reject('no data recieved. Check stop ID?');
      }
      const departures = reply.results;
      
      // sort departures with earliest departures first
      departures.sort((a, b) => {
        const timeA = a.estimatedTime; // ignore upper and lowercase
        const timeB = b.estimatedTime; // ignore upper and lowercase
        if (timeA < timeB) {
          return -1;
        }
        if (timeA > timeB) {
          return 1;
        }
        return 0;
      });
      
      //console.log('departures',departures[2])
      let k = 0;
      
      //*DEBUG*/ frames.push('departures.length:' + departures.length)
      //*DEBUG*/ frames.push('FRAMESMAX:' + FRAMESMAX)
      
      // loop through all departures sent in the data
      for(let i=0; i<departures.length; i++) {
        // if we've reached the max of the results we need, exit
        if (k >= FRAMESMAX) {
          break;
        }
        const departure = departures[i];
        const stopPoint = departure.stopPoint; 
        const platform = stopPoint.platform; 
        const departureTime = departure.estimatedTime; 
        const serviceJourney = departure.serviceJourney.line;
        //console.log('serviceJourney',serviceJourney)
        
        // dump all departures from platforms that we're NOT interested in (TRACK)
        if (!TRACK.includes(platform)) {
          continue;
        }
        
        // calc time of departure, compare to current time (with UTC+1 adjust)
        const departureTimeZuluObj = new Date(departureTime);
        //console.log('-----')
        //console.log('dateZuluISO:',dateZuluISO);
        //console.log('departureDateObj:',departureTimeZuluObj);
        const departureDateWaitMs = departureTimeZuluObj.getTime() - dateZulu.getTime(); // note the UTC/CET adjustment
        const departureDateWaitMins = Math.round(departureDateWaitMs / 1000 / 60);
        // if it's less than the minimum time it would take to get to the stop, ignore it
        if (departureDateWaitMins < MINTIME) {
          continue;
        }
        // if the tram/bus is more than X mins away, assume it's tomorrow. Otherwise, print it.
        //const departureDateWaitHuman = (departureDateWaitMins > TOMORROW ? 'TOM' : departureDateWaitMins + 'M' );
        const departureDateWaitHuman = departureDateWaitMins + 'M';
        // choose icon
        let icon = ICONBUS;
        if (serviceJourney.transportMode === 'tram') {
          icon = ICONTRAMOLD;
          if (serviceJourney.isWheelchairAccessible) {
            icon = ICONTRAMNEW;
          }
        }
        //console.log('departure',departure)
        // fill a frame
        frames.push({
          'icon': icon,
          'text': serviceJourney.shortName + ((DIRECTION ? DEFICON : ALTICON ) + '') + departureDateWaitHuman
        });
        k++;
      }
      
      if (!frames.length) {
        frames = {
          'icon': ICONERROR,
          'text': 'no departures found for id=' + STOPID + ', ' + dateZulu
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
        'dateZulu': dateZulu,
        'url': apiUrl,
        //'departures': departures,
        'departuresLength': departures.length,
        'frames': frames 
      };
      //console.log('dataOut',dataOut)
      return resolve(dataOut);
    });
  });
}

// KICK IT OFF!!

http.createServer((req, res) => {
  
  
  getOauth2(req).then(token => {
    
    const urlQuery = url.parse(req.url,true).query;
    
    if (req.url.includes('/search')) {
      
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      const html = `
      <html>
        <head>
          <title>Search for Västtrafik stops</title>
          <style>
            body {
              font-family: sans-serif;
              font-size: 16px;
            }
            input {
              display: block;
              width: 100%;
              margin: 0.5em 0;
              padding: 0.3em;
            }
          </style>
        </head>
        <body>
          <h1>Search for Västtrafik stop IDs and platforms</h1>
          <p>For use in setting up the <a href="https://apps.lametric.com/apps/v%C3%A4sttrafik_h%C3%A5llplats/3953?product=market&market=en-US">LaMetric Västtrafik App</a></p>
          
          <p>Enter a name of a stop below and you will be presented with IDs and platforms of that stop, used in the set-up of the App</P>
          
          <form method="get" action="/">
            <fieldset>
              <label>
                Hållplats:
                <input type="text" name="stop" placeholder="eg Centralstationen Göteborg">
                <input type="submit" value="search">
              </label>
            </fieldset>
          </form>
          
          <p>This project is in no-way affiliated with Västtrafik.</p>
          <p>Code for the NodeJS side of this app is available on <a href="https://github.com/pixelthing/lametric-vasttrafik">GitHub</a>.</p> 
          <p>Based on V4 of the <a href="https://developer.vasttrafik.se/">Västtrafik public API</a>.
          
        </body>
      </html>`;
      res.end(html);
      
    
    } else if (urlQuery.stop) {
      
      const stopsFound = getStops(token,urlQuery.stop).then(HTML => {

        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        const html = `
        <html>
          <head>
            <title>Looking up stops for ${urlQuery.stop}</title>
            <style>
              body {
                font-family: sans-serif;
              font-size: 16px;
              }
            </style>
          </head>
          <body>
            ${HTML}
            <p><a href="search">Back to search</a></p>
          </body>
        </html>`;
        res.end(html);
        
        
      })
      
      return;
    } else {
      
      getDueTimes(token,req).then(data => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(data));
      }).catch(error => {
        console.error('-----------\nFINAL PARSING ERROR');
        console.error(error);
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify( error ));
      });
      
    }
    
    
    
  }).catch(reply => {
    console.error('-----------\nFINAL OAUTH ERROR');
    console.error('reply', reply);
    const data = {
      frames : [{
        'icon': ICONERROR,
        'text': 'OAuth2 error: ' + reply.error
      }]
    };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(data));
  });
  
}).listen(3000);