{
	// The app is not currently linked to the encore.dev platform.
	// Use "encore app link" to link it.
	"id":   "",
	"lang": "typescript",
	"build": {
		"worker_pooling": true
	},
	"global_cors": {
		"allow_origins_with_credentials": [
			"http://localhost:3000",
			"http://localhost:5173",
            "https://lightwing.urs.deno.net",
            "https://comp.cosyne.jp.eu.org"
	],
		"allow_origins_without_credentials": [
            "http://localhost:3000", 
            "http://localhost:5173",
            "https://lightwing.urs.deno.net",
            "https://comp.cosyne.jp.eu.org"
        ],
		"debug": true
	}
}
