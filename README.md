# PabzOfficial · iPod Player

A static HTML, CSS and JavaScript website, ready for GitHub Pages. No installation, build step or API keys are needed.

## Publish on GitHub Pages

1. Extract this ZIP.
2. Create a GitHub repository (public if using GitHub Free).
3. Upload the contents of this folder into the repository root. Keep `index.html`, `styles.css`, `app.js`, `tracks.js` and the images together, rather than uploading the ZIP itself.
4. Commit the files to the `main` branch.
5. Open **Settings → Pages**.
6. Under **Source**, choose **Deploy from a branch**.
7. Choose **main** and **/(root)**, then click **Save**.
8. GitHub will display the website URL when publication finishes.

Documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Files

- `index.html`: branding, player structure and music embeds.
- `styles.css`: purple background, responsive layout, player styling and 3D effects.
- `app.js`: Music/Socials menus, playback, circular touch gestures and mouse tilt.
- `tracks.js`: the track data loaded by the player.
- `tracks.json`: a JSON copy of the track data for editing or reuse; if you change the catalog, update `tracks.js` too.
- `artist-avatar.webp`: logo/profile picture.
- `artist-banner.webp`: retained original image asset; currently unused.
- `.nojekyll`: serves the files directly without Jekyll processing.

## Run locally

From this folder, run:

```sh
python -m http.server 8000
```

Open http://localhost:8000 in your browser. Python 3 must be installed for this command.

## Edit

Edit `styles.css` to change the design. Update the `socials` array near the beginning of `app.js` to change profile links. Edit `tracks.js` to update the music catalog.

The website keeps the iPod in the centre. Mouse movement controls its tilt; touch devices keep it steady and use circular wheel gestures. Clockwise moves down menus, anticlockwise moves up. SELECT requires one tap or click. Rotation does not change the song on the Now Playing screen.

## External media

Previews, artwork and Spotify/Apple Music players use existing external URLs. They require internet access and depend on the providers' availability and browser autoplay rules. This export contains source code and local images, rather than downloaded audio files.
