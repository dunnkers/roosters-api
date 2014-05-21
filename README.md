# Roosters API

Dit is de back-end van de roosters applicatie, een API.

De scraper (`update.js`) haalt de roosters op van intranet en vervolgens stelt de API (`server.js`) ze beschikbaar via [api-roosters.rhcloud.com](https://api-roosters.rhcloud.com/)

## Technologie
De back-end draait op [`Node.js`](http://nodejs.org/) en maakt gebruik van:

- [Cheerio](http://matthewmueller.github.io/cheerio/)
- [Restler](https://github.com/danwrong/restler)
- [MongoJS](http://mafintosh.github.io/mongojs/)
- [Express](http://expressjs.com/)
- [RSVP.js](https://github.com/tildeio/rsvp.js/)
- [Lo-Dash](http://lodash.com/)
