'use strict';
var express = require('express');
var path = require('path');
var morgan = require('morgan');
var axios = require('axios');
var mongoose = require('mongoose');
var app = express();
mongoose.connect('mongodb://daynil:d49nDcm%bYO%$d8C@ds023468.mlab.com:23468/imagesearchcache');
var flickrKey = '0a532377595b0172223d7137864b6397';
var flickrBaseUrl = 'https://api.flickr.com/services/rest/?method=';
var searchCacheSchema = new mongoose.Schema({
    recentSearches: [{ term: String, when: String, _id: false }]
});
var SearchCache = mongoose.model('SearchCache', searchCacheSchema); // Collection searchcaches
app.use(morgan('dev'));
var pathname = path.join(process.cwd());
app.use(express.static(pathname));
function stripFlickrString(flickrStr) {
    // Strip flickr string from response
    var resStr = flickrStr.data;
    var resGbg = 'jsonFlickrApi(';
    return JSON.parse(resStr.substring(resGbg.length, resStr.length - 1));
}
function imageSearch(searchTerm, pageNum) {
    var flkrRequest = flickrBaseUrl + "flickr.photos.search&api_key=" + flickrKey + "&format=json&text=" + searchTerm + "&per_page=10";
    if (pageNum)
        flkrRequest += "&page=" + pageNum;
    return new Promise(function (resolve, reject) {
        axios
            .get(flkrRequest)
            .then(function (results) { return resolve({ results: results, searchTerm: searchTerm }); })
            .catch(function (err) { return reject(err); });
    });
}
function processPhotoData(asyncResults) {
    var resJson = stripFlickrString(asyncResults.results);
    var photos = resJson.photos.photo;
    var searchResults = [];
    return new Promise(function (resolve, reject) {
        photos.forEach(function (photo) {
            var constructedUrl = "https://farm" + photo.farm + ".staticflickr.com/" + photo.server + "/" + photo.id + "_" + photo.secret + ".jpg";
            var newPhoto = {
                url: constructedUrl,
                text: photo.title,
                context: "https://www.flickr.com/photos/" + photo.owner + "/" + photo.id
            };
            searchResults.push(newPhoto);
        });
        resolve({ results: searchResults, searchTerm: asyncResults.searchTerm });
    });
}
function cacheResults(asyncResults) {
    SearchCache.findOne({})
        .exec()
        .then(function (cache) {
        if (cache == null) {
            var newCache = new SearchCache({
                recentSearches: [
                    {
                        term: asyncResults.searchTerm,
                        when: new Date().toString()
                    }
                ]
            });
            newCache.save(function (err) {
                if (err)
                    console.log(err);
            });
        }
        else {
            if (cache.recentSearches.length > 10) {
                cache.recentSearches.shift();
            }
            cache.recentSearches.push({
                term: asyncResults.searchTerm,
                when: new Date().toString()
            });
            cache.save(function (err) { return console.log(err); });
        }
    });
}
app.get('/recent', function (req, res) {
    SearchCache.findOne({}).exec()
        .then(function (cache) {
        if (cache == null)
            res.status(200).end('No recent searches!');
        else {
            var searchesArray = cache.recentSearches;
            // Make sure results are in desired order
            var orderedResults = [];
            for (var i = searchesArray.length - 1; i >= 0; i--) {
                orderedResults.push({
                    term: searchesArray[i].term,
                    when: searchesArray[i].when
                });
            }
            res.status(200).json(orderedResults);
        }
    }, function (err) { return res.status(400).json({ 'error': err.toString() }); });
});
app.get('/:searchTerm', function (req, res) {
    var searchTerm = req.params.searchTerm;
    if (searchTerm == 'favicon.ico')
        return;
    var pageNum = req.query.offset;
    imageSearch(searchTerm, pageNum)
        .then(processPhotoData)
        .then(function (results) {
        cacheResults(results);
        res.status(200).json(results.results);
    })
        .catch(function (err) { return res.status(400).json({ 'error': err.toString() }); });
});
var port = process.env.PORT || 3000;
app.listen(port, function () { return console.log('Listening on port ' + port + '...'); });
//# sourceMappingURL=server.js.map