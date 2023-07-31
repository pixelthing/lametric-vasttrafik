#lametric-vasttrafik
--------------------

[<img src="https://github.com/pixelthing/lametric-vasttrafik/assets/1090350/bb39b906-03be-49f2-9469-61ce2bddbb7a" width="50%">](https://youtu.be/RyqnHhDtqmM "Video of the LaMetric app consuming the feed in this project")

Node app for Västtrafik API call (OAUTH2, returning a departure board for a particular stop), used to spit out frames for a Lametric Internet clock app.

The current LaMetric app is a simple indicator that polls every 15 secs. It has the following fields that are set in the LaMetric app and passed to the node app via URL args:

- stopid (Text field - the Västtrafik id of the stop/hållplats to monitor)
- track (Text field - the Västtrafik id of the track of the stop to monitor eg comma delimted "A,C" for monitoring multiple stops or sides of the road - but remember if you monitor both directions, the different directions are not displayed on the screen)
- framesmax (Number - the number of coming departures to show before looping)
- mintime (Number - the minimum number of minutes a departure can be, ie if it took you 3 mins to get to the stop, you could set "3" and it wouldn't show any trams leaving in less than 3 minutes)

##Notes:

- The LaMetric app is available to add to your LaMetric internet clock at https://apps.lametric.com/apps/v%C3%A4sttrafik_h%C3%A5llplats/3953?product=market&market=en-US
- The Server is currently hosted on Glitch: https://vasttrafik-next-tram.glitch.me
- This uses the V4 Västtrafik public API: https://developer.vasttrafik.se/
- There are three urls available in this NodeJS web server:
    - https://vasttrafik-next-tram.glitch.me/search (a search form interface to help find the stop and platform IDs of a location from a text keyword)
    - https://vasttrafik-next-tram.glitch.me/?stop=KEYWORD (the search results from the previous form)
    - https://vasttrafik-next-tram.glitch.me/?stopid=9021014004230000&track=A%2CC&framesmax=3&mintime=3 (the LaMetric click polling URL including all the query settings that can be added to the app)
- some work was done on implementing a "opposite direction" feature, where you could click the LaMetric clock button and see an alternative set of platforms for the same stop (ie, if you set up the default platforms as "towards town", the alternatives could be "away from town"), but I couldn't get it to work. The code for this is largelye still present.
