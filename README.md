# My Virtual Library — starter prototype

## Included
- Responsive layout for phone, tablet, and computer
- Virtual bookshelf, cover gallery, and list views
- Search saved books by title, author, ISBN, genre, or description
- Open Library title/author/ISBN search and ISBN metadata lookup
- Barcode scanning in supported browsers when camera access is available
- Add, edit, and remove books
- Four visual themes
- JSON export and restore/merge backup

## Important limitation
This first prototype stores books in the current browser's local storage. It does **not yet sync across devices**. The next development stage is adding authentication and a cloud database (for example, Supabase). A free cloud tier can be a good start, but has provider quotas; we will not add an app-imposed book-count paywall.

## Run locally
From this folder, run:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`. Camera scanning generally needs HTTPS or localhost and a browser that supports `BarcodeDetector`.

## Book data
Open Library is a third-party catalog. Metadata and covers may be missing or edition-specific, and API availability is outside this app's control.
