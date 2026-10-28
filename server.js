/* ==========================================
   THARAZZ EVENTS - BACKEND (Node.js)
   No npm packages needed. Run: node server.js
========================================== */

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/* ---------- CONFIG ---------- */

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const TICKET_PRICES = { Standard: 499, Premium: 999, VIP: 1999 };

fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------- SECRET KEY ---------- */

function loadSecret() {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

    const file = path.join(DATA_DIR, "secret.key");

    try {
        return fs.readFileSync(file, "utf8").trim();
    } catch (error) {
        const secret = crypto.randomBytes(48).toString("hex");
        fs.writeFileSync(file, secret, { mode: 0o600 });
        return secret;
    }
}

const SECRET = loadSecret();

/* ---------- JSON FILE DATABASE ---------- */

const DB_FILE = path.join(DATA_DIR, "db.json");

function loadDb() {
    try {
        const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
        return {
            users: Array.isArray(db.users) ? db.users : [],
            tickets: Array.isArray(db.tickets) ? db.tickets : []
        };
    } catch (error) {
        return { users: [], tickets: [] };
    }
}

let db = loadDb();

function saveDb() {
    const temp = DB_FILE + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(db, null, 2));
    fs.renameSync(temp, DB_FILE);
}

/* ---------- PASSWORDS (scrypt) ---------- */

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return salt + ":" + hash;
}

function checkPassword(password, stored) {
    const parts = String(stored).split(":");
    if (parts.length !== 2) return false;

    const expected = Buffer.from(parts[1], "hex");
    const actual = crypto.scryptSync(password, parts[0], 64);

    return expected.length === actual.length &&
        crypto.timingSafeEqual(expected, actual);
}

/* ---------- TOKENS (HMAC signed) ---------- */

function sign(data) {
    return crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
}

function createToken(email) {
    const payload = Buffer.from(JSON.stringify({
        email: email,
        exp: Date.now() + TOKEN_TTL_MS
    })).toString("base64url");

    return payload + "." + sign(payload);
}

function readToken(token) {
    if (!token) return null;

    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const expected = Buffer.from(sign(parts[0]));
    const actual = Buffer.from(parts[1]);

    if (expected.length !== actual.length ||
        !crypto.timingSafeEqual(expected, actual)) {
        return null;
    }

    try {
        const payload = JSON.parse(
            Buffer.from(parts[0], "base64url").toString("utf8")
        );
        return payload.exp > Date.now() ? payload : null;
    } catch (error) {
        return null;
    }
}

function getAuthUser(req) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const payload = readToken(token);

    if (!payload) return null;

    return db.users.find(function (user) {
        return user.email === payload.email;
    }) || null;
}

/* ---------- RATE LIMIT (simple, per IP) ---------- */

const attempts = new Map();

function tooManyAttempts(req, limit) {
    const ip = req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;

    const list = (attempts.get(ip) || []).filter(function (time) {
        return now - time < windowMs;
    });

    list.push(now);
    attempts.set(ip, list);

    return list.length > limit;
}

/* ---------- HTTP HELPERS ---------- */

function sendJson(res, status, data) {
    const body = JSON.stringify(data);

    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        "Cache-Control": "no-store"
    });
    res.end(body);
}

function readBody(req) {
    return new Promise(function (resolve, reject) {
        let size = 0;
        const chunks = [];

        req.on("data", function (chunk) {
            size += chunk.length;

            if (size > 20000) {
                reject(new Error("Request too large."));
                req.destroy();
                return;
            }

            chunks.push(chunk);
        });

        req.on("end", function () {
            try {
                const text = Buffer.concat(chunks).toString("utf8");
                resolve(text ? JSON.parse(text) : {});
            } catch (error) {
                reject(new Error("Invalid JSON."));
            }
        });

        req.on("error", reject);
    });
}

function isEmail(value) {
    return typeof value === "string" &&
        value.length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createTicketNumber() {
    let number;

    do {
        number = "THZ-" +
            Date.now().toString().slice(-8) + "-" +
            crypto.randomBytes(3).toString("hex").toUpperCase();
    } while (db.tickets.some(function (t) { return t.number === number; }));

    return number;
}

/* ---------- API ROUTES ---------- */

async function handleApi(req, res, pathname) {
    /* Health check */
    if (req.method === "GET" && pathname === "/api/health") {
        return sendJson(res, 200, { ok: true });
    }

    /* Sign up */
    if (req.method === "POST" && pathname === "/api/signup") {
        if (tooManyAttempts(req, 30)) {
            return sendJson(res, 429, { error: "Too many attempts. Try later." });
        }

        const body = await readBody(req);
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (!name || name.length > 100) {
            return sendJson(res, 400, { error: "Enter a valid name." });
        }

        if (!isEmail(email)) {
            return sendJson(res, 400, { error: "Enter a valid email." });
        }

        if (password.length < 8 || password.length > 200) {
            return sendJson(res, 400, {
                error: "Password must have at least 8 characters."
            });
        }

        if (db.users.some(function (user) { return user.email === email; })) {
            return sendJson(res, 409, {
                error: "Email already registered. Please login."
            });
        }

        db.users.push({
            name: name,
            email: email,
            passwordHash: hashPassword(password),
            createdAt: new Date().toISOString()
        });
        saveDb();

        return sendJson(res, 201, { message: "Account created." });
    }

    /* Login */
    if (req.method === "POST" && pathname === "/api/login") {
        if (tooManyAttempts(req, 30)) {
            return sendJson(res, 429, { error: "Too many attempts. Try later." });
        }

        const body = await readBody(req);
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

        const user = db.users.find(function (item) {
            return item.email === email;
        });

        if (!user || !checkPassword(password, user.passwordHash)) {
            return sendJson(res, 401, { error: "Incorrect email or password." });
        }

        return sendJson(res, 200, {
            token: createToken(user.email),
            user: { name: user.name, email: user.email }
        });
    }

    /* Everything below needs login */
    const user = getAuthUser(req);

    if (!user) {
        return sendJson(res, 401, { error: "Please login to continue." });
    }

    /* Current user */
    if (req.method === "GET" && pathname === "/api/me") {
        return sendJson(res, 200, {
            user: { name: user.name, email: user.email }
        });
    }

    /* Book ticket */
    if (req.method === "POST" && pathname === "/api/tickets") {
        const body = await readBody(req);
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const type = String(body.type || "");
        const quantity = Number(body.quantity);

        if (!name || name.length > 100 || !isEmail(email)) {
            return sendJson(res, 400, { error: "Please fill in all booking details." });
        }

        if (!Object.prototype.hasOwnProperty.call(TICKET_PRICES, type)) {
            return sendJson(res, 400, { error: "Select a valid ticket type." });
        }

        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
            return sendJson(res, 400, { error: "Select between 1 and 10 tickets." });
        }

        if (email !== user.email) {
            return sendJson(res, 400, {
                error: "Use the email address registered to your logged-in account."
            });
        }

        const ticket = {
            number: createTicketNumber(),
            name: name,
            email: email,
            type: type,
            quantity: quantity,
            total: TICKET_PRICES[type] * quantity,
            status: "Confirmed",
            createdAt: new Date().toISOString()
        };

        db.tickets.push(ticket);
        saveDb();

        return sendJson(res, 201, { ticket: ticket });
    }

    /* Verify ticket (marks it as Used) */
    if (req.method === "POST" && pathname === "/api/tickets/verify") {
        if (ADMIN_EMAIL && user.email !== ADMIN_EMAIL) {
            return sendJson(res, 403, {
                error: "Only the event admin can verify tickets."
            });
        }

        const body = await readBody(req);
        const number = String(body.number || "").trim().toLowerCase();

        if (!number) {
            return sendJson(res, 400, { error: "Enter a booking number." });
        }

        const ticket = db.tickets.find(function (item) {
            return item.number.toLowerCase() === number;
        });

        if (!ticket) {
            return sendJson(res, 404, {
                error: "Ticket not found. Please check the booking number."
            });
        }

        if (ticket.status === "Used") {
            return sendJson(res, 409, {
                error: "This ticket has already been used."
            });
        }

        ticket.status = "Used";
        ticket.usedAt = new Date().toISOString();
        saveDb();

        return sendJson(res, 200, { ticket: ticket });
    }

    return sendJson(res, 404, { error: "Not found." });
}

/* ---------- STATIC FILES ---------- */

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
};

function serveStatic(req, res, pathname) {
    let relative;

    try {
        relative = decodeURIComponent(pathname);
    } catch (error) {
        res.writeHead(400);
        return res.end("Bad request");
    }

    if (relative === "/") relative = "/index.html";

    const filePath = path.normalize(path.join(PUBLIC_DIR, relative));

    if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
        res.writeHead(403);
        return res.end("Forbidden");
    }

    fs.readFile(filePath, function (error, content) {
        if (error) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            return res.end("Not found");
        }

        res.writeHead(200, {
            "Content-Type": MIME_TYPES[path.extname(filePath)] ||
                "application/octet-stream"
        });
        res.end(content);
    });
}

/* ---------- SERVER ---------- */

const server = http.createServer(async function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
    }

    const pathname = new URL(req.url, "http://localhost").pathname;

    if (pathname.startsWith("/api/")) {
        try {
            await handleApi(req, res, pathname);
        } catch (error) {
            const known = error.message === "Invalid JSON." ||
                error.message === "Request too large.";

            if (!known) console.error(error);

            if (!res.headersSent) {
                sendJson(res, known ? 400 : 500, {
                    error: known ? error.message : "Server error."
                });
            }
        }
        return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405);
        return res.end("Method not allowed");
    }

    serveStatic(req, res, pathname);
});

server.listen(PORT, function () {
    console.log("THARAZZ EVENTS running at http://localhost:" + PORT);
});
