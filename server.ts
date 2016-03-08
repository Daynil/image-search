'use strict';
import * as express from 'express';
import * as path from 'path';
import * as morgan from 'morgan';
import * as axios from 'axios';
const app: express.Express = express();

const flickrKey = '0a532377595b0172223d7137864b6397';
const flickrSecret = 'e63a18c2dc0c77e2';
const flickrBaseUrl = 'https://api.flickr.com/services/rest/?method=';

class Photo {
	contextUrl: string;
	description: any;
	constructor(public url: string, public text: string) { }
}
let searchResults: Photo[] = [];

app.use(morgan('dev'));
let pathname = path.join(process.cwd());
app.use( express.static(pathname) );

function stripFlickrString(flickrStr) {
	// Strip flickr string from response
	let resStr: string = flickrStr.data;
	let resGbg = 'jsonFlickrApi(';
	return JSON.parse(resStr.substring(resGbg.length, resStr.length-1));
}

function imageSearch(searchTerm: string) {
	let flkrRequest = `${flickrBaseUrl}flickr.photos.search&api_key=${flickrKey}&format=json&text=${searchTerm}&per_page=3`;
	return axios.get(flkrRequest);
}

function processPhotoData(results) {
	let resJson = stripFlickrString(results);
	let photos: Array<any> = resJson.photos.photo;
	
	let photoDetailsPromises = [];
	photos.forEach(photo => {
		let constructedUrl = `https://farm${photo.farm}.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}.jpg`;
		let newPhoto: Photo = new Photo(constructedUrl, photo.title);
		let photoDetailsProm =  axios.get(`${flickrBaseUrl}flickr.photos.getInfo&format=json&api_key=${flickrKey}&photo_id=${photo.id}&secret=${photo.secret}`);
		photoDetailsProm.then(photoInfo => {
				newPhoto.description = stripFlickrString(photoInfo);
				searchResults.push(newPhoto);
		});
		photoDetailsPromises.push(photoDetailsProm);
	});
	return Promise.all(photoDetailsPromises);
}

app.get('/:searchTerm', (req, res) => {
	let searchTerm = req.params.searchTerm;
	let pageNum = req.query.offset;
	imageSearch(searchTerm)
		.then(processPhotoData)
		.then(results => {
			//console.log();
			res.status(200).json(searchResults[0].description);
		})
		.catch(err => res.status(400).json({'error': err.toString()}));
});
 
app.get('/recent', (req, res) => {
	// handle recent query
});

let port = process.env.PORT || 3000;
app.listen(port, () => console.log('Listening on port ' + port + '...'));