lametric-vasttrafik
--------------------
Node app for Västtrafik API call (OAUTH2, returning a departure board for a particular stop), used to spit out frames for a Lametric Internet clock app.

The current LaMetric app is in "private" mode, but is a simple indicator that polls every 15 secs. It has the following fields that are passed to the node app via URL args:

key (OAuth2 Text field)
secret (OAuth2 Text field)
stopid (Text field)
track (Text field, eg "A,C")
framesmax (Number)
mintime (Number)
