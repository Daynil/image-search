'use strict';
var express = require('express');
var path = require('path');
var morgan = require('morgan');
var axios = require('axios');
var mongoose = require('mongoose');
var app = express();
mongoose.connect('mongodb://daynil:d49nDcm%bYO%$d8C@ds023468.mlab.com:23468/imagesearchcache');
var flickrKey = '0a532377595b0172223d7137864b6397';
var flickrSecret = 'e63a18c2dc0c77e2';
var flickrBaseUrl = 'https://api.flickr.com/services/rest/?method=';
var userCacheSchema = new mongoose.Schema({
    user: String,
    searches: Array
});
var UserCache = mongoose.model('UserCache', userCacheSchema); // Collection userCaches
var searchResults = [];
//let searchCache: userCache[] = [];
app.use(morgan('dev'));
var pathname = path.join(process.cwd());
app.use(express.static(pathname));
function stripFlickrString(flickrStr) {
    // Strip flickr string from response
    var resStr = flickrStr.data;
    var resGbg = 'jsonFlickrApi(';
    return JSON.parse(resStr.substring(resGbg.length, resStr.length - 1));
}
function imageSearch(searchTerm, pageNum, userIP) {
    var flkrRequest = flickrBaseUrl + "flickr.photos.search&api_key=" + flickrKey + "&format=json&text=" + searchTerm + "&per_page=10";
    if (pageNum)
        flkrRequest += "&page=" + pageNum;
    return axios.get(flkrRequest);
}
function processPhotoData(results) {
    var resJson = stripFlickrString(results);
    var photos = resJson.photos.photo;
    // Clear old results
    searchResults = [];
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
        resolve();
    });
}
/**
 * If a given user exists in cache, add results, otherwise create a new entry for the user.
 */
function cacheResults(userIP, searchTerm) {
    var existingUser = false;
    return UserCache.findOne({ user: userIP }).exec();
    /*	searchCache.forEach(userCache => {
            if (userCache.user == userIP) {
                existingUser = true;
                userCache.searches.push({
                    term: searchTerm,
                    when: new Date().toString()
                });
            }
        });
        if (!existingUser) {
            searchCache.push({
                user: userIP,
                searches: [
                    {
                        term: searchTerm,
                        when: new Date().toString()
                    }
                ]
            });
        }*/
}
function getUserCache(userIP) {
    var cache = [];
    /*	searchCache.forEach(userCache => {
            if (userCache.user == userIP) {
                cache = userCache.searches;
            }
        });*/
    return cache;
}
app.get('/recent', function (req, res) {
    // handle recent query
    var userIP = req.headers['x-forwarded-for'] || req.ip;
    console.log('IP at retreival: ', userIP);
    var userCache = getUserCache(userIP);
    res.status(200).json(userCache);
});
app.get('/:searchTerm', function (req, res) {
    var searchTerm = req.params.searchTerm;
    if (searchTerm == 'favicon.ico')
        return;
    var pageNum = req.query.offset;
    var userIP = req.headers['x-forwarded-for'] || req.ip;
    console.log('IP at cache: ', userIP);
    imageSearch(searchTerm, pageNum, userIP)
        .then(processPhotoData)
        .then(function (results) {
        cacheResults(userIP, searchTerm);
        res.status(200).json(searchResults);
    })
        .catch(function (err) { return res.status(400).json({ 'error': err.toString() }); });
});
var port = process.env.PORT || 3000;
app.listen(port, function () { return console.log('Listening on port ' + port + '...'); });
//# sourceMappingURL=server.js.map