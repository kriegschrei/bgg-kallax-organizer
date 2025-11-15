i'd like to change the POST to the API and clean up a few things.  This will change a bit in @bgcubeApi.js  and @server.js 

1.  includeStatuses is required and may not be NULL, no real change there but the API should return an error if it's undefined or empty.
2. excludeStatues is optional. On the backend, check if it exists and process if it does, but it's not required.  On the front end let's not send it unless we have data to pass.
3. Priorities, keep as is, but the existance of the object means it's enabled, so you can just have {"field":"foo","order":"asc"}, you don't need enabled.  On the front end only pass fields enabled in the order they're listed. If none are defined (like with optimize space), don't pass the key/array. On the backend, just parse over whatever exists and apply ascending descending. If undefined, I guess treat it as name ascending as the default.  Optimize space will still set it as total area descending.
4. I don't like verticalstacking = true as the control for verticalstacking/horizontalstacking. change it to stacking with "horizontal" or "vertical", this is required and those are the only 2 options. return an error if anything else is sent.
5. all of these are optional and default to false if not passed.  front end only passes if true, back end treats undefined as false. 
includeExpansions: false,
  "lockRotation": false,
  "optimizeSpace": false,
  "respectSortOrder": false,
  "fitOversized": false,
  "groupExpansions": false,
  "groupSeries": false,
6. I think these are the same, aren't they?  we should only define one, the default is false, only pass true from front end, back end treats empty as false.  Let's use bypassVersionWarning and remove skipVersionCHeck.
  "skipVersionCheck": false,
  "bypassVersionWarning": false
7. overrides is also optional, as is each element in it.  front end only passes overrides if one element is defined and not empty, and empty elements are not passed. back end checks for existance and treats lack of existence as empty and skips the functions called.
  "overrides": {
    "excludedGames": [],
    "orientationOverrides": [],
    "dimensionOverrides": []
  },
8. add a field for the username (not requestID). username is required.
9. can the backend generate a guid for the request id instead and return that in the response? remove requestID generation from the front end and add front end handling to store the request ID and use it for any status requests, if the front end needs the request ID for anything.


Here's an example of the current POST.
{"includeStatuses":["own"],"excludeStatuses":[],"includeExpansions":false,"priorities":[{"field":"name","enabled":true,"order":"asc"},{"field":"categories","enabled":false,"order":"asc"},{"field":"families","enabled":false,"order":"asc"},{"field":"bggRank","enabled":false,"order":"asc"},{"field":"minPlayers","enabled":false,"order":"asc"},{"field":"maxPlayers","enabled":false,"order":"asc"},{"field":"bestPlayerCount","enabled":false,"order":"asc"},{"field":"minPlaytime","enabled":false,"order":"asc"},{"field":"maxPlaytime","enabled":false,"order":"asc"},{"field":"age","enabled":false,"order":"asc"},{"field":"communityAge","enabled":false,"order":"asc"},{"field":"weight","enabled":false,"order":"asc"},{"field":"bggRating","enabled":false,"order":"desc"}],"verticalStacking":true,"lockRotation":false,"optimizeSpace":false,"respectSortOrder":false,"fitOversized":false,"groupExpansions":false,"groupSeries":false,"requestId":"kriegschrei-1762740667472","skipVersionCheck":false,"overrides":{"excludedGames":[],"orientationOverrides":[],"dimensionOverrides":[]},"bypassVersionWarning":false}

Desired minimal set

{
  "includeStatuses": [
    "own"
  ],
  "username": "kriegschrei",
  "stacking": "horizontal"
}

Example with other options
{"includeStatuses":["own"],"excludeStatuses":["pre-ordered"],"includeExpansions":true,"priorities":[{"field":"name","order":"asc"},{"field":"categories","order":"asc"}],"stacking":"horizontal","lockRotation":true,"optimizeSpace":true,"respectSortOrder":true,"fitOversized":true,"groupExpansions":true,"groupSeries":true,"usename":"kriegschrei","skipVersionCheck":true,"overrides":{"excludedGames":["foo"]},"bypassVersionWarning":true}

@review.mdc and propose changes. @bgcubeApi.js @server.js 