'use strict';
import * as express from 'express';
import * as path from 'path';
import * as morgan from 'morgan';
import * as axios from 'axios';
import * as mongoose from 'mongoose';
const app: express.Express = express();
mongoose.connect('mongodb://daynil:d49nDcm%bYO%$d8C@ds023468.mlab.com:23468/imagesearchcache');

const flickrKey = '0a532377595b0172223d7137864b6397';
const flickrBaseUrl = 'https://api.flickr.com/services/rest/?method=';

interface Photo {
	url: string;
	text: string;
	context: string;
}

interface AsyncResults {
	results: any;
	searchTerm: string;
}

interface searchCache {
	recentSearches: {
		term: string;
		when: string;
	}[];
}

let searchCacheSchema = new mongoose.Schema({
	recentSearches: [{ term: String, when: String, _id: false }]
});

let SearchCache = mongoose.model('SearchCache', searchCacheSchema); // Collection searchcaches

app.use(morgan('dev'));
let pathname = path.join(process.cwd());
app.use( express.static(pathname) );

function stripFlickrString(flickrStr) {
	// Strip flickr string from response
	let resStr: string = flickrStr.data;
	let resGbg = 'jsonFlickrApi(';
	return JSON.parse(resStr.substring(resGbg.length, resStr.length-1));
}

function imageSearch(searchTerm: string, pageNum: string) {
	let flkrRequest = `${flickrBaseUrl}flickr.photos.search&api_key=${flickrKey}&format=json&text=${searchTerm}&per_page=10`;
	if (pageNum) flkrRequest += `&page=${pageNum}`;
	return new Promise<AsyncResults>((resolve, reject) => {
		axios
			.get(flkrRequest)
			.then(results => resolve({results: results, searchTerm: searchTerm}))
			.catch(err =>  reject(err));
	});
}

function processPhotoData(asyncResults: AsyncResults) {
	let resJson = stripFlickrString(asyncResults.results);
	let photos: Array<any> = resJson.photos.photo;
	
	let searchResults = [];
	return new Promise<AsyncResults>((resolve, reject) => {
		photos.forEach(photo => {
			let constructedUrl = `https://farm${photo.farm}.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}.jpg`;
			let newPhoto: Photo = {
				url: constructedUrl,
				text: photo.title,
				context: `https://www.flickr.com/photos/${photo.owner}/${photo.id}`
			};
			searchResults.push(newPhoto);
		});
		resolve({results: searchResults, searchTerm: asyncResults.searchTerm});
	});

}

function cacheResults(asyncResults: AsyncResults) {
	SearchCache.findOne({})
		.exec()
		.then((cache: any) => {
			if (cache == null) {
				let newCache = new SearchCache({ 
					recentSearches: [
						{
							term: asyncResults.searchTerm,
							when: new Date().toString()
						}
					]
				});
				newCache.save( (err) => {
					if (err) console.log(err);
				})
			}
			else {
				if (cache.recentSearches.length > 10) {
					cache.recentSearches.shift();
				}
				cache.recentSearches.push(
					{
						term: asyncResults.searchTerm,
						when: new Date().toString()
					}
				);
				cache.save(err => console.log(err));
			}
		});
}

app.get('/recent', (req, res) => {
	SearchCache.findOne({}).exec()
		.then((cache: any) => {
			if (cache == null) res.status(200).end('No recent searches!');
			else {
				let searchesArray = cache.recentSearches;
				// Make sure results are in desired order
				let orderedResults = [];
				for (let i = searchesArray.length-1; i >=0; i--) {
					orderedResults.push(
						{
							term: searchesArray[i].term,
							when: searchesArray[i].when
						}
					)
				}
				res.status(200).json(orderedResults);
			}
		},
				(err) => res.status(400).json({'error': err.toString()}));
});

app.get('/:searchTerm', (req, res) => {
	let searchTerm: string = req.params.searchTerm;
	if (searchTerm == 'favicon.ico') return;
	let pageNum = req.query.offset;
	imageSearch(searchTerm, pageNum)
		.then(processPhotoData)
		.then((results: AsyncResults) => {
			cacheResults(results);
			res.status(200).json(results.results);
		})
		.catch(err => res.status(400).json({'error': err.toString()}));
});
 


let port = process.env.PORT || 3000;
app.listen(port, () => console.log('Listening on port ' + port + '...'));