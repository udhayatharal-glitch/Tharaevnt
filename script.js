/* ==========================================
   THARAZZ EVENTS - LUXURY FASHION EXPO
   FRONTEND JAVASCRIPT (talks to the backend API)
========================================== */

"use strict";

/* ---------- CONFIGURATION ---------- */

/*
  API_BASE:
  - Backend and frontend served together (npm start / Render): leave as "".
  - Frontend on GitHub Pages and backend on Render/Railway:
    put the backend URL here, e.g.
    const API_BASE = "https://tharazz-events.onrender.com";
*/
const API_BASE = "";

const TICKET_PRICES = {
    Standard: 499,
    Premium: 999,
    VIP: 1999
};

const DRESSES = [
    {
        id: 1,
        name: "Elegant Party Gown",
        category: "Party Dresses",
        price: 2499,
        rating: 4.8,
        reviews: 124,
        description: "An elegant evening gown for parties, celebrations and special occasions.",
        image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=700&q=85"
    },
    {
        id: 2,
        name: "Luxury Evening Dress",
        category: "Party Dresses",
        price: 3299,
        rating: 4.7,
        reviews: 98,
        description: "A glamorous outfit designed for an elegant party look.",
        image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=700&q=85"
    },
    {
        id: 3,
        name: "Western Chic Dress",
        category: "Western Dresses",
        price: 1799,
        rating: 4.5,
        reviews: 76,
        description: "A stylish western outfit for outings, dinners and casual events.",
        image: "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?auto=format&fit=crop&w=700&q=85"
    },
    {
        id: 4,
        name: "Classic Black Dress",
        category: "Western Dresses",
        price: 2199,
        rating: 4.9,
        reviews: 145,
        description: "A timeless black dress with a sophisticated modern look.",
        image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=700&q=85"
    },
    {
        id: 5,
        name: "Traditional Ethnic Wear",
        category: "Traditional Dresses",
        price: 2899,
        rating: 4.6,
        reviews: 89,
        description: "Beautiful traditional fashion for festive occasions and celebrations.",
        image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=700&q=85"
    },
    {
        id: 6,
        name: "Designer Vision Dress",
        category: "Vision Dresses",
        price: 3599,
        rating: 4.8,
        reviews: 112,
        description: "A designer-inspired statement outfit for a standout fashion look.",
        image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=700&q=85"
    }
];

let selectedDressId = null;

/* ---------- HELPERS ---------- */

function getElement(id) {
    return document.getElementById(id);
}

function formatPrice(price) {
    return Number(price).toLocaleString("en-IN");
}

function showMessage(id, message) {
    const element = getElement(id);

    if (element) {
        element.textContent = message;
    }
}

/* ---------- SESSION (token from backend) ---------- */

function getToken() {
    return sessionStorage.getItem("tharazzToken");
}

function getCurrentUser() {
    return sessionStorage.getItem("tharazzEmail");
}

function setSession(token, email) {
    sessionStorage.setItem("tharazzToken", token);
    sessionStorage.setItem("tharazzEmail", email);
}

function clearSession() {
    sessionStorage.removeItem("tharazzToken");
    sessionStorage.removeItem("tharazzEmail");
}

/* ---------- API CALL ---------- */

async function api(path, options) {
    options = options || {};

    const headers = { "Content-Type": "application/json" };
    const token = getToken();

    if (token) {
        headers.Authorization = "Bearer " + token;
    }

    let response;

    try {
        response = await fetch(API_BASE + path, {
            method: options.method || "GET",
            headers: headers,
            body: options.body ? JSON.stringify(options.body) : undefined
        });
    } catch (error) {
        throw new Error("Cannot reach the server. Please try again.");
    }

    let data = {};

    try {
        data = await response.json();
    } catch (error) {
        data = {};
    }

    if (response.status === 401 && token) {
        clearSession();
    }

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

/* ---------- PAGE NAVIGATION ---------- */

function showPage(pageId) {
    const protectedPages = [
        "home",
        "products",
        "dressDetails",
        "booking",
        "ticketResult",
        "scanner"
    ];

    if (protectedPages.includes(pageId) && !getToken()) {
        alert("Please login to continue.");
        pageId = "login";
    }

    document.querySelectorAll(".page").forEach(function (page) {
        page.classList.remove("active");
    });

    const page = getElement(pageId);

    if (page) {
        page.classList.add("active");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (pageId === "products") {
        displayProducts("All");
    }

    if (pageId === "booking") {
        const email = getCurrentUser();
        if (email && !getElement("ticketEmail").value) {
            getElement("ticketEmail").value = email;
        }
    }
}

/* ---------- SIGN UP ---------- */

async function signupUser(event) {
    event.preventDefault();

    const name = getElement("signupName").value.trim();
    const email = getElement("signupEmail").value.trim().toLowerCase();
    const password = getElement("signupPassword").value;

    if (!name || !email || password.length < 8) {
        showMessage(
            "signupMessage",
            "Enter your details. Password must have at least 8 characters."
        );
        return;
    }

    showMessage("signupMessage", "Creating account...");

    try {
        await api("/api/signup", {
            method: "POST",
            body: { name: name, email: email, password: password }
        });

        getElement("signupForm").reset();
        showMessage("signupMessage", "");
        showMessage("loginMessage", "Account created. Please login.");
        showPage("login");
    } catch (error) {
        showMessage("signupMessage", error.message);
    }
}

/* ---------- LOGIN ---------- */

async function loginUser(event) {
    event.preventDefault();

    const email = getElement("loginEmail").value.trim().toLowerCase();
    const password = getElement("loginPassword").value;

    showMessage("loginMessage", "Logging in...");

    try {
        const data = await api("/api/login", {
            method: "POST",
            body: { email: email, password: password }
        });

        setSession(data.token, data.user.email);
        getElement("loginForm").reset();
        showMessage("loginMessage", "");

        alert("Login successful. Welcome to THARAZZ EVENTS!");
        showPage("home");
    } catch (error) {
        showMessage("loginMessage", error.message);
    }
}

/* ---------- LOGOUT ---------- */

function logoutUser() {
    clearSession();
    alert("You have logged out.");
    showPage("welcome");
}

/* ---------- DRESS COLLECTIONS ---------- */

function displayProducts(category) {
    const container = getElement("productList");

    if (!container) return;

    container.replaceChildren();

    const filtered = category === "All"
        ? DRESSES
        : DRESSES.filter(function (dress) {
            return dress.category === category;
        });

    filtered.forEach(function (dress) {
        const card = document.createElement("article");
        card.className = "product-card";

        const image = document.createElement("img");
        image.src = dress.image;
        image.alt = dress.name;
        image.loading = "lazy";

        image.onerror = function () {
            image.alt = dress.name + " image unavailable";
            image.style.objectFit = "contain";
        };

        const title = document.createElement("h3");
        title.textContent = dress.name;

        const rating = document.createElement("p");
        rating.className = "rating";
        rating.textContent =
            "★ ★ ★ ★ ★ " + dress.rating + " (" +
            dress.reviews + " reviews)";

        const description = document.createElement("p");
        description.textContent = dress.description;

        const price = document.createElement("p");
        price.className = "price";
        price.textContent = "₹" + formatPrice(dress.price);

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "View Details";

        button.addEventListener("click", function () {
            openDressDetails(dress.id);
        });

        card.append(image, title, rating, description, price, button);
        container.appendChild(card);
    });

    if (filtered.length === 0) {
        container.textContent = "No dresses found in this category.";
    }
}

function filterProducts(category) {
    displayProducts(category);
}

function openDressDetails(dressId) {
    const dress = DRESSES.find(function (item) {
        return item.id === dressId;
    });

    if (!dress) return;

    selectedDressId = dress.id;

    const container = getElement("dressDetailsContent");
    container.replaceChildren();

    const image = document.createElement("img");
    image.src = dress.image;
    image.alt = dress.name;

    const details = document.createElement("div");

    const title = document.createElement("h2");
    title.textContent = dress.name;

    const category = document.createElement("p");
    category.textContent = "Category: " + dress.category;

    const rating = document.createElement("p");
    rating.className = "rating";
    rating.textContent =
        "★ ★ ★ ★ ★ " + dress.rating +
        " / 5 (" + dress.reviews + " reviews)";

    const price = document.createElement("p");
    price.className = "price";
    price.textContent = "₹" + formatPrice(dress.price);

    const description = document.createElement("p");
    description.textContent = dress.description;

    details.append(title, category, rating, price, description);
    container.append(image, details);

    showPage("dressDetails");
}

/* ---------- TICKET PRICE (display only; server recalculates) ---------- */

function calculateTicketPrice() {
    const type = getElement("ticketType").value;
    const quantity = Number(getElement("ticketQuantity").value);

    const validQuantity =
        Number.isInteger(quantity) && quantity >= 1 && quantity <= 10;

    const total = validQuantity
        ? (TICKET_PRICES[type] || 0) * quantity
        : 0;

    getElement("ticketPrice").textContent = formatPrice(total);
    return total;
}

/* ---------- BOOK TICKET ---------- */

async function bookTicket(event) {
    event.preventDefault();

    if (!getToken()) {
        showPage("login");
        return;
    }

    const name = getElement("ticketName").value.trim();
    const email = getElement("ticketEmail").value.trim().toLowerCase();
    const type = getElement("ticketType").value;
    const quantity = Number(getElement("ticketQuantity").value);

    if (!name || !email || !TICKET_PRICES[type]) {
        showMessage("bookingMessage", "Please fill in all booking details.");
        return;
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        showMessage("bookingMessage", "Select between 1 and 10 tickets.");
        return;
    }

    if (email !== getCurrentUser()) {
        showMessage(
            "bookingMessage",
            "Use the email address registered to your logged-in account."
        );
        return;
    }

    showMessage("bookingMessage", "Booking your ticket...");

    try {
        const data = await api("/api/tickets", {
            method: "POST",
            body: { name: name, email: email, type: type, quantity: quantity }
        });

        showMessage("bookingMessage", "");
        getElement("bookingForm").reset();
        calculateTicketPrice();

        displayTicket(data.ticket);
        showPage("ticketResult");
    } catch (error) {
        showMessage("bookingMessage", error.message);

        if (!getToken()) {
            showPage("login");
        }
    }
}

/* ---------- DISPLAY TICKET + QR ---------- */

function displayTicket(ticket) {
    getElement("ticketDetails").textContent =
        "Name: " + ticket.name +
        "\nEmail: " + ticket.email +
        "\nTicket: " + ticket.type +
        "\nQuantity: " + ticket.quantity +
        "\nTotal: ₹" + formatPrice(ticket.total);

    getElement("ticketDetails").style.whiteSpace = "pre-line";

    getElement("ticketNumber").textContent = ticket.number;
    getElement("ticketStatus").textContent = "Status: " + ticket.status;

    const qr = getElement("ticketQR");

    const qrPayload = JSON.stringify({
        bookingNumber: ticket.number
    });

    qr.src =
        "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" +
        encodeURIComponent(qrPayload);

    qr.alt = "QR code for booking " + ticket.number;
}

/* ---------- VERIFY TICKET ---------- */

async function verifyTicket(event) {
    if (event) event.preventDefault();

    const number = getElement("scanTicketNumber").value.trim();

    if (!number) {
        showMessage("scannerMessage", "Enter a booking number.");
        return;
    }

    showMessage("scannerMessage", "Checking...");

    try {
        const data = await api("/api/tickets/verify", {
            method: "POST",
            body: { number: number }
        });

        showMessage(
            "scannerMessage",
            "Ticket verified successfully! " +
            data.ticket.name + " - " + data.ticket.type +
            " - " + data.ticket.number
        );
    } catch (error) {
        showMessage("scannerMessage", error.message);
    }
}

/* ---------- PRINT TICKET ---------- */

function printTicket() {
    const ticketNumber = getElement("ticketNumber").textContent.trim();

    if (!ticketNumber) {
        alert("Please book a ticket first.");
        return;
    }

    window.print();
}

/* ---------- EVENT LISTENERS ---------- */

document.addEventListener("DOMContentLoaded", function () {
    getElement("signupForm").addEventListener("submit", signupUser);
    getElement("loginForm").addEventListener("submit", loginUser);
    getElement("bookingForm").addEventListener("submit", bookTicket);
    getElement("scannerForm").addEventListener("submit", verifyTicket);

    getElement("ticketType").addEventListener("change", calculateTicketPrice);
    getElement("ticketQuantity").addEventListener("input", calculateTicketPrice);

    displayProducts("All");
    calculateTicketPrice();
    showPage("welcome");
});
