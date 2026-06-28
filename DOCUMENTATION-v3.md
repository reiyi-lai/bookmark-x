## Tweet Extraction

### How it works

When a user visits `x.com/i/bookmarks`, X.com sends a GET request to X.com's own backend's GraphQL API, with a hash in the parameters to retrieve the bookmarks to be rendered.
```
GET /i/api/graphql/{deployment-hash}/Bookmarks?variables={"count":20,"cursor":"..."}&features={...}
```
This is written in X.com’s own JS script as a XHR request.

The main 2 optimizations we made are
1. Identify the hash that's found when X.com fires that GET request, 
2. Replay that GET request with a new cursor bottom value as ‘pagination’ to fetch the next subseq batch of tweets.

The `{hash}` changes every time X.com deploys new code. It's the same for all users at any given time, but can't be hardcoded since it changes frequently.

### Key optimizations

**1. XHR hook for request discovery and initial extraction**

We inject our own script into the page's own JS context (MAIN world) at `document_start`, before X.com's code runs. 

- `XMLHttpRequest.prototype.send` is wrapped to check if the URL matches X.com's bookmarks GraphQL endpoint (/i/api/graphql/<hash>/Bookmarks).
- For matching requests, it wraps `onreadystatechange` to read the response JSON before X.com's own handler runs. This way we piggyback on the requests X.com already makes — no extra network calls needed for the initial page load.

- **Captures the hash and GraphQL request template** from the URL, so we know the current GraphQL endpoint to call for pagination.
- **Extracts tweets from the first response** by reading the JSON before passing control to X.com's original handler. 

We don't send a duplicate — we read the response as it passes through.

**2. Direct cursor pagination**

Instead of scrolling the page, we send the GET request directly to the GraphQL API via `fetch()`, swapping the `cursor` parameter each time.

Each GraphQL response contains a `cursorType: "Bottom"` entry that points to its bottom. We extract it and pass it as the cursor in the next request:

```
Response 1 response → cursor: "HBaawLXl5eTipSUAAA==" → Request 2
Response 2 response → cursor: "HCaQxMnm6fXxpSUAAA==" → Request 3
...until no cursor is returned or the cursor value repeats
```

Impact:
Instead of waiting seconds between every 20 tweets for a scroll, we fetch ~130 tweets/second, with a set 150ms delay between requests to avoid rate limiting. 350 bookmarks take ~4 seconds versus minutes of manual scrolling.

