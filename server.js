'use strict';
var express = require('express');
var path = require('path');
var morgan = require('morgan');
var axios = require('axios');
var app = express();
var flickrKey = '0a532377595b0172223d7137864b6397';
var flickrSecret = 'e63a18c2dc0c77e2';
var flickrBaseUrl = 'https://api.flickr.com/services/rest/?method=';
var Photo = (function () {
    function Photo(url, text) {
        this.url = url;
        this.text = text;
    }
    return Photo;
})();
var searchResults = [];
app.use(morgan('dev'));
var pathname = path.join(process.cwd());
app.use(express.static(pathname));
function stripFlickrString(flickrStr) {
    // Strip flickr string from response
    var resStr = flickrStr.data;
    var resGbg = 'jsonFlickrApi(';
    return JSON.parse(resStr.substring(resGbg.length, resStr.length - 1));
}
function imageSearch(searchTerm) {
    var flkrRequest = flickrBaseUrl + "flickr.photos.search&api_key=" + flickrKey + "&format=json&text=" + searchTerm + "&per_page=3";
    return axios.get(flkrRequest);
}
function processPhotoData(results) {
    var resJson = stripFlickrString(results);
    var photos = resJson.photos.photo;
    var photoDetailsPromises = [];
    photos.forEach(function (photo) {
        var constructedUrl = "https://farm" + photo.farm + ".staticflickr.com/" + photo.server + "/" + photo.id + "_" + photo.secret + ".jpg";
        var newPhoto = new Photo(constructedUrl, photo.title);
        var photoDetailsProm = axios.get(flickrBaseUrl + "flickr.photos.getInfo&format=json&api_key=" + flickrKey + "&photo_id=" + photo.id + "&secret=" + photo.secret);
        photoDetailsProm.then(function (photoInfo) {
            newPhoto.description = stripFlickrString(photoInfo);
            searchResults.push(newPhoto);
        });
        photoDetailsPromises.push(photoDetailsProm);
    });
    return Promise.all(photoDetailsPromises);
}
app.get('/:searchTerm', function (req, res) {
    var searchTerm = req.params.searchTerm;
    var pageNum = req.query.offset;
    imageSearch(searchTerm)
        .then(processPhotoData)
        .then(function (results) {
        //console.log();
        res.status(200).json(searchResults[0].description);
    })
        .catch(function (err) { return res.status(400).json({ 'error': err.toString() }); });
});
app.get('/recent', function (req, res) {
    // handle recent query
});
var port = process.env.PORT || 3000;
app.listen(port, function () { return console.log('Listening on port ' + port + '...'); });
