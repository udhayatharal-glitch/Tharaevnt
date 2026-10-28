# THARAZZ EVENTS - Luxury Fashion Expo

Frontend (HTML/CSS/JS) + Node.js backend (no npm packages needed).

## Run on your computer
1. Install Node.js (v18 or newer): https://nodejs.org
2. Open a terminal in this folder and run:

       npm start

3. Open http://localhost:3000

## Folder structure
    server.js        -> backend (API + serves the website)
    package.json
    public/
      index.html
      style.css
      script.js      -> frontend (set API_BASE here if hosted separately)
    data/            -> created automatically (users + tickets). Not uploaded to GitHub.

## Put it online (GitHub + Render)
GitHub Pages can host ONLY the frontend (public/ folder). The backend needs a Node host.

1. Upload this whole folder to a GitHub repository.
2. Go to https://render.com -> New -> Web Service -> connect your repo.
   - Build command: (leave empty)
   - Start command: `npm start`
3. Render gives a link like https://tharazz-events.onrender.com - the full website works there.

Optional environment variables (Render -> Environment):
- ADMIN_EMAIL    -> only this account can use the Ticket Scanner
- JWT_SECRET     -> any long random text (keeps logins stable)
- ALLOWED_ORIGIN -> your GitHub Pages URL, only if frontend is hosted separately

### If you also want the frontend on GitHub Pages
Open public/script.js and set:

    const API_BASE = "https://your-render-link.onrender.com";

Then set ALLOWED_ORIGIN on Render to https://YOURNAME.github.io

Note: free Render servers have temporary storage, so data/db.json may reset
on redeploy. For permanent data, use a database (MongoDB Atlas / PostgreSQL).
