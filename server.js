'use strict';
const express = require('express');
const app = express();
const path = require('path');
const morgan = require('morgan');
const xray = require('x-ray');
const x = xray();

app.use(morgan('dev'));
let pathname = path.join(process.cwd());
app.use( express.static(pathname) );

function imageSearch(searchTerm) {
	let googleImgUrl = `https://www.google.com/search?q=${searchTerm}&source=lnms&tbm=isch`;
	return new Promise((resolve, reject) => {
		x(googleImgUrl, 'title')((err, title) => {
			if (err) reject(err);
			else resolve(title);
		});
	});
}

app.get('/:searchTerm', (req, res) => {
	let searchTerm = req.params.searchTerm;
	let pageNum = req.query.offset;
	imageSearch(searchTerm)
		.then(result => {
			res.status(200).end(result);
		})
		.catch(err => res.status(400).end(err));
});

app.get('/recent', (req, res) => {
	// handle recent query
});

let port = process.env.PORT || 3000;
app.listen(port, () => console.log('Listening on port ' + port + '...'));