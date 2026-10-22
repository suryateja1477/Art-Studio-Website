# 🎨 Art Studio Website

> A complete Full-Stack Web Platform built with **Node.js**, **Express.js**, **EJS**, and **MongoDB**.

---

## 🌟 Overview

The Art Studio web application powers three specialized studio mechanics across two distinct user roles (**Customer** and **Studio Admin**):

1. **Original Fine Art Gallery:** One-of-a-kind handmade paintings (12 pre-seeded artworks). Each artwork can be purchased only once with atomic double-buy protection. Order cancellations automatically restore the artwork to the gallery.
2. **Wall Mural Scheduling:** On-site mural installations priced dynamically per square foot (₹150/sq. ft.). Bounded between 7 and 90 days in advance, with atomic single-booking-per-date guarantees, studio confirmation/decline controls, and a 3-day cancellation cutoff.
3. **Custom Studio Pottery Requests:** Custom terracotta and stoneware batch orders (1 to 12 pieces) with artisanal glaze finishes. Requires a minimum 14-day kiln-firing lead time, studio review controls, and customer edit/cancel permissions strictly locked to pending requests.

---

## 🚀 Quick Start Guide

Follow these steps to run the application on a clean machine:

### 1. Prerequisites
- **Node.js** (v18.x or later)
- **MongoDB** running locally (`mongodb://localhost:27017`) OR a **MongoDB Atlas** connection string

### 2. Clone and Install Dependencies
```bash
git clone <your-repository-url>
cd "Art Studio Website"
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory (or copy from `.env.example`):
```bash
cp .env.example .env
```

Your `.env` should look like:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/art_studio
JWT_SECRET=supersecret_art_studio_jwt_key_2026
```
*(To use MongoDB Atlas, simply replace `MONGODB_URI` with your Atlas connection string).*

### 4. Seed the Database
Populate the 12 original paintings, pottery vessels, glazes, mural rates, and the studio admin account:
```bash
npm run seed
```

### 5. Start the Server
- **Development Mode (with auto-reload):**
  ```bash
  npm run dev
  ```
- **Production Mode:**
  ```bash
  npm start
  ```

Open your browser and navigate to:  
👉 **`http://localhost:3000`**

---

## 🔑 Test Accounts & Demo Credentials

| Role | Email | Password | Access Privileges |
| :--- | :--- | :--- | :--- |
| **Studio Admin** | `studio@artstudio.in` | `Studio@123` | Confirm/decline bookings, accept/decline pottery requests, add/edit available paintings, view all customer orders. |
| **Customer** | *Self-Register* | *Your Choice* | Browse paintings, atomic purchase, book wall dates, request pottery, edit/cancel owned requests. |

---

## 🛡️ Concurrency & RBAC Architecture

- **Race Condition Prevention:**
  - *Paintings:* Atomic `findOneAndUpdate({ _id, status: 'available' }, { status: 'sold' })` prevents race conditions when multiple users click "Buy" simultaneously.
  - *Calendar Dates:* MongoDB Partial Unique Index on `{ dateString: 1 }` prevents concurrent double-booking of any calendar date.
- **Role-Based Access Control:**
  - `401 Unauthorized`: Unauthenticated attempts on protected routes redirect to login.
  - `403 Forbidden`: Unauthorized role actions (e.g. customers attempting admin actions) are refused.
  - `404 Not Found`: When a customer attempts to query or cancel another user's record, the server returns 404 to prevent resource enumeration.
- **UI State Adherence:** Every data-driven screen provides loading indicators, clear empty states, and descriptive refusal error banners.

---

## 📁 Project Structure

```
Art Studio Website/
├── config/
│   └── db.js                 # Mongoose connection module
├── models/
│   ├── User.js               # User accounts & RBAC roles
│   ├── Painting.js           # Artwork inventory & status
│   ├── Order.js              # Painting acquisition orders
│   ├── Booking.js            # Wall mural on-site bookings
│   ├── PotteryRequest.js     # Bespoke ceramic batch requests
│   └── StudioConfig.js       # Mural rates & pottery options
├── middleware/
│   ├── auth.js               # JWT verification & currentUser injection
│   └── rbac.js               # Role-based route authorization
├── routes/
│   ├── auth.js               # Signup, login, logout
│   ├── paintings.js          # Catalog & studio CRUD
│   ├── orders.js             # Atomic purchases & cancellations
│   ├── bookings.js           # Wall mural scheduling & studio decisions
│   └── pottery.js            # Custom ceramic requests & lifecycle
├── seeds/
│   └── seed.js               # Database seeder from seedData/seed.json
├── public/
│   ├── css/style.css         # Modern styling & responsive design
│   └── images/               # Artwork photos (p-001.jpg - p-012.jpg)
├── views/
│   ├── partials/             # header.ejs, footer.ejs
│   ├── auth/                 # login.ejs, register.ejs
│   ├── paintings/            # index.ejs, show.ejs, new.ejs, edit.ejs
│   ├── orders/               # index.ejs
│   ├── bookings/             # index.ejs, new.ejs
│   ├── pottery/              # index.ejs, new.ejs, edit.ejs
│   ├── home.ejs              # Landing overview
│   └── error.ejs             # Centralized error handler
├── .env.example              # Committed environment template
├── DESIGN.md                 # System architecture & brief question answers
└── README.md                 # Setup & testing documentation
```

---

## 📜 Project Verification Checklist

- [x] Public GitHub repository ready
- [x] No API keys or real `.env` committed (`.gitignore` configured)
- [x] Complete `.env.example` with placeholder values
- [x] Comprehensive `README.md` with step-by-step clean machine setup instructions
- [x] Complete `DESIGN.md` answering the 4 evaluation questions
- [x] All three core studio mechanics implemented and verified
- [x] Atomic concurrency protection and strict RBAC enforcement
