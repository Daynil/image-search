'use strict';
import * as express from 'express';
import * as path from 'path';
import * as morgan from 'morgan';
import * as axios from 'axios';
const app: express.Express = express();

const flickrKey = '0a532377595b0172223d7137864b6397';
const flickrSecret = 'e63a18c2dc0c77e2';
const flickrBaseUrl = 'https://api.flickr.com/services/rest/?method=';

interface Photo {
	url: string;
	text: string;
	context: string;
}

interface recentSearches {
	term: string;
	when: string;
	results: Photo[];	
}

interface userCache {
	user: string;
	searches: recentSearches[];
}

let searchResults: Photo[] = [];
let searchCache: userCache[] = [];

app.use(morgan('dev'));
let pathname = path.join(process.cwd());
app.use( express.static(pathname) );

function stripFlickrString(flickrStr) {
	// Strip flickr string from response
	let resStr: string = flickrStr.data;
	let resGbg = 'jsonFlickrApi(';
	return JSON.parse(resStr.substring(resGbg.length, resStr.length-1));
}

function imageSearch(searchTerm: string, pageNum: string, userIP: string) {
	// Be a good citizen and return cached results for duplicate search queries
	let userCache = getUserCache(userIP);
	userCache.forEach(search => {
		if (search.term == searchTerm) return searchResults = search.results;
	});
	let flkrRequest = `${flickrBaseUrl}flickr.photos.search&api_key=${flickrKey}&format=json&text=${searchTerm}&per_page=10`;
	if (pageNum) flkrRequest += `&page=${pageNum}`;
	return axios.get(flkrRequest);
}

function processPhotoData(results) {
	let resJson = stripFlickrString(results);
	let photos: Array<any> = resJson.photos.photo;
	
	// Clear old results
	searchResults = [];
	photos.forEach(photo => {
		let constructedUrl = `https://farm${photo.farm}.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}.jpg`;
		let newPhoto: Photo = {
			url: constructedUrl,
			text: photo.title,
			context: `https://www.flickr.com/photos/${photo.owner}/${photo.id}`
		};
		searchResults.push(newPhoto);
	});
	return;
}

/**
 * If a given user exists in cache, add results, otherwise create a new entry for the user.
 */
function cacheResults(userIP: string, searchTerm: string) {
	searchCache.forEach(userCache => {
		if (userCache.user == userIP) {
			userCache.searches.push({
				term: searchTerm,
				when: new Date().toString(),
				results: searchResults
			});
			return;
		}
	});
	// If we got here, no cache exists for the user, create one
	searchCache.push({
		user: userIP,
		searches: [
			{
				term: searchTerm,
				when: new Date().toString(),
				results: searchResults
			}
		]
	});
}

function getUserCache(userIP: string) {
	searchCache.forEach(userCache => {
		if (userCache.user == userIP) {
			return userCache.searches;
		}
	});
	return [];
}

app.get('/recent', (req, res) => {
	// handle recent query
	let userIP = req.headers['x-forwarded-for'] || req.ip;
	let userCache = getUserCache(userIP);
	res.status(200).json(userCache);
});

app.get('/:searchTerm', (req, res) => {
	let searchTerm: string = req.params.searchTerm;
	if (searchTerm == 'favicon.ico') return;
	let pageNum = req.query.offset;
	let userIP = req.headers['x-forwarded-for'] || req.ip;
	imageSearch(searchTerm, pageNum, userIP)
		.then(processPhotoData)
		.then(results => {
			cacheResults(userIP, searchTerm);
			res.status(200).json(searchResults);
		})
		.catch(err => res.status(400).json({'error': err.toString()}));
});
 


let port = process.env.PORT || 3000;
app.listen(port, () => console.log('Listening on port ' + port + '...'));