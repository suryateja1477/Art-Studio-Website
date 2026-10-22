# 🎨 Art Studio Website — Implementation Plan

> **Full-Stack Web Development Implementation Plan**
> Deadline: **23-Oct-2026 (11:59 PM IST)** · ~2.5 days remaining

---

## 1. Tech Stack Decision

| Layer | Choice | Why |
|-------|--------|-----|
| **Runtime** | Node.js | JavaScript everywhere — you already know MERN basics |
| **Backend** | Express.js | Minimal, well-documented, beginner-friendly |
| **Templating** | EJS | Server-rendered pages — Express injects data directly into HTML templates. No separate frontend build step |
| **Database** | MongoDB Atlas (free M0 cluster) | Cloud-hosted (the brief prefers this), flexible schema fits the three different data models, and you have MERN experience |
| **ODM** | Mongoose | Schema validation, middleware hooks, makes MongoDB feel structured |
| **Auth** | JWT in HTTP-only cookies | Stateless, secure (HTTP-only cookie prevents XSS token theft), easy to explain in interview |
| **Password Hashing** | bcrypt | Industry standard, simple API |
| **Styling** | Vanilla CSS | Brief says "simple interface is fine, we are not judging visual design" — don't over-invest here |
| **Validation** | express-validator | Clean server-side input validation for forms |

### Why NOT React/Vite?
- The brief evaluates **functionality and understanding**, not UI polish
- EJS eliminates an entire build toolchain (Vite, React Router, state management)
- Server-rendered pages are easier to reason about for auth/RBAC — no token storage headaches
- You can explain every line in the interview without framework magic

### Key npm packages

```
express           - web server
mongoose          - MongoDB ODM
ejs               - templating
bcrypt            - password hashing
jsonwebtoken      - JWT creation/verification
cookie-parser     - read JWT from cookies
express-validator - input validation
dotenv            - env variables
method-override   - support PUT/DELETE from HTML forms
morgan            - request logging (dev)
nodemon           - auto-restart on file changes (dev)
```

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   BROWSER                        │
│  EJS-rendered HTML pages + Vanilla CSS + JS      │
└──────────────────────┬──────────────────────────┘
                       │  HTTP requests (forms + links)
                       ▼
┌─────────────────────────────────────────────────┐
│              EXPRESS SERVER (Node.js)             │
│                                                   │
│  ┌─────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Auth    │  │  RBAC    │  │  Route          │  │
│  │Middleware│─►│Middleware │─►│  Handlers       │  │
│  └─────────┘  └──────────┘  └────────┬───────┘  │
│                                       │          │
│  ┌────────────────────────────────────▼───────┐  │
│  │          Mongoose Models                    │  │
│  │  User · Painting · Order · Booking · Pottery│  │
│  └────────────────────────────────────┬───────┘  │
└───────────────────────────────────────┼──────────┘
                                        │
                                        ▼
                            ┌──────────────────┐
                            │  MongoDB Atlas    │
                            │  (Cloud - Free)   │
                            └──────────────────┘
```

### Request Flow (example: Customer buys a painting)

```
1. Customer clicks "Buy" on painting card
2. Browser sends POST /orders  (with painting ID in form body)
3. Auth middleware → verifies JWT cookie → attaches user to req
4. RBAC middleware → checks user.role === 'customer'
5. Route handler:
   a. Finds painting by ID
   b. Checks painting.status === 'available' (concurrency guard)
   c. Uses findOneAndUpdate with { status: 'available' } filter
      → If another customer bought it first, the update returns null
      → Show "this painting was just sold" error
   d. Creates Order document with status: 'placed'
   e. Redirects to /orders with success flash
6. EJS renders the orders page with updated data
```

> [!IMPORTANT]
> The `findOneAndUpdate` with a status filter is the key concurrency pattern. It's an **atomic operation** — MongoDB guarantees only one request wins. This is exactly what the brief asks in DESIGN.md question 3: "How do you stop two people from taking the same painting or date?"

---

## 3. Database Schema Design

### User

```javascript
{
  email:    { type: String, unique: true, required: true },
  password: { type: String, required: true },         // bcrypt hash
  name:     { type: String, required: true },
  role:     { type: String, enum: ['customer', 'studio'], required: true },
  createdAt: Date
}
```

### Painting

```javascript
{
  title:       String,
  artist:      String,
  description: String,
  price:       Number,                                    // in INR
  imageUrl:    String,                                    // path to image file
  status:      { type: String, enum: ['available', 'sold'], default: 'available' },
  createdAt:   Date
}
```

### Order (painting purchase)

```javascript
{
  painting:  { type: ObjectId, ref: 'Painting' },
  customer:  { type: ObjectId, ref: 'User' },
  status:    { type: String, enum: ['placed', 'cancelled'], default: 'placed' },
  totalPrice: Number,
  createdAt:  Date
}
```

### Booking (wall painting)

```javascript
{
  customer:    { type: ObjectId, ref: 'User' },
  date:        { type: Date, required: true },             // unique — one booking per date
  wallSizeSqFt:{ type: Number, min: 10, max: 500 },
  address:     { type: String, required: true },
  ratePerSqFt: { type: Number },                           // snapshot from seed (Rs.150)
  totalPrice:  { type: Number },                           // wallSize x rate
  status:      { type: String, enum: ['requested', 'confirmed', 'declined', 'cancelled'],
                 default: 'requested' },
  createdAt:   Date
}
```

> The `date` field has a **unique index** — MongoDB rejects a second booking for the same date atomically.

### PotteryRequest

```javascript
{
  customer:    { type: ObjectId, ref: 'User' },
  item:        { type: String, required: true },           // e.g., "Kulhad (clay cup)"
  itemId:      { type: String },                           // e.g., "i-01"
  glaze:       { type: String, required: true },           // e.g., "Kumkum Red"
  glazeId:     { type: String },                           // e.g., "g-01"
  quantity:    { type: Number, min: 1, max: 12 },
  neededBy:    { type: Date, required: true },             // at least 14 days from now
  status:      { type: String, enum: ['requested', 'accepted', 'declined', 'cancelled'],
                 default: 'requested' },
  createdAt:   Date
}
```

---

## 4. Folder Structure

```
art-studio-website/
├── .env.example              # placeholder env vars (committed)
├── .env                      # actual secrets (gitignored)
├── .gitignore
├── package.json
├── README.md
├── DESIGN.md                 # answers to the 4 brief questions
├── server.js                 # entry point — app setup, DB connect, listen
│
├── config/
│   └── db.js                 # Mongoose connection logic
│
├── models/
│   ├── User.js
│   ├── Painting.js
│   ├── Order.js
│   ├── Booking.js
│   └── PotteryRequest.js
│
├── routes/
│   ├── auth.js               # POST /register, POST /login, GET /logout
│   ├── paintings.js          # GET / (browse), GET /:id, POST / (admin add),
│   │                         #   PUT /:id (admin edit)
│   ├── orders.js             # POST / (buy), GET / (list), POST /:id/cancel
│   ├── bookings.js           # POST / (book), GET / (list),
│   │                         #   POST /:id/confirm, POST /:id/decline,
│   │                         #   POST /:id/cancel
│   └── pottery.js            # POST / (request), GET / (list),
│                             #   PUT /:id (edit), POST /:id/accept,
│                             #   POST /:id/decline, POST /:id/cancel
│
├── middleware/
│   ├── auth.js               # verifyToken — reads JWT from cookie, attaches req.user
│   └── rbac.js               # requireRole('customer') / requireRole('studio')
│
├── seeds/
│   └── seed.js               # script to populate DB from seedData/seed.json
│
├── public/
│   ├── css/
│   │   └── style.css         # all styles
│   ├── js/
│   │   └── main.js           # minimal client-side JS (form validation, flash messages)
│   └── images/               # painting images from seedData (p-001.jpg to p-012.jpg)
│
└── views/
    ├── partials/
    │   ├── header.ejs         # nav bar, login/logout links, role-based menu
    │   └── footer.ejs
    ├── home.ejs               # landing page
    ├── error.ejs              # global error page
    ├── auth/
    │   ├── login.ejs
    │   └── register.ejs
    ├── paintings/
    │   ├── index.ejs          # gallery grid — all paintings
    │   ├── show.ejs           # single painting detail + "Buy" button
    │   ├── new.ejs            # admin: add painting form
    │   └── edit.ejs           # admin: edit painting form
    ├── orders/
    │   └── index.ejs          # customer: my orders / admin: all orders
    ├── bookings/
    │   ├── new.ejs            # customer: book a wall painting form
    │   └── index.ejs          # customer: my bookings / admin: all bookings
    └── pottery/
        ├── new.ejs            # customer: request pottery form
        ├── edit.ejs           # customer: edit a pending request
        └── index.ejs          # customer: my requests / admin: all requests
```

---

## 5. Key Implementation Details

### 5.1 Authentication Flow

```
REGISTER → POST /auth/register
  1. Validate email, password, name
  2. Check if email already exists → 409 Conflict
  3. Hash password with bcrypt (salt rounds = 10)
  4. Create User with role: 'customer' (studio account is pre-seeded)
  5. Create JWT { userId, role } → set as HTTP-only cookie
  6. Redirect to /paintings

LOGIN → POST /auth/login
  1. Find user by email
  2. Compare password with bcrypt
  3. Create JWT → set cookie
  4. Redirect to /paintings

LOGOUT → GET /auth/logout
  1. Clear the cookie
  2. Redirect to /login
```

> [!NOTE]
> The studio/admin account (`studio@artstudio.in` / `Studio@123`) is created by the seed script. Customers self-register. There's no studio sign-up route — exactly as the brief's "out of scope" table says.

### 5.2 RBAC Middleware

```javascript
// middleware/auth.js
function verifyToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).redirect('/auth/login');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;   // { userId, role }
    next();
  } catch (err) {
    res.status(401).redirect('/auth/login');
  }
}

// middleware/rbac.js
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).render('error', { message: 'Access denied' });
    }
    next();
  };
}
```

Usage in routes:
```javascript
router.post('/orders', verifyToken, requireRole('customer'), createOrder);
router.post('/bookings/:id/confirm', verifyToken, requireRole('studio'), confirmBooking);
```

### 5.3 Concurrency: Stopping Double-Buys and Double-Bookings

**Painting (atomic status flip):**
```javascript
const painting = await Painting.findOneAndUpdate(
  { _id: paintingId, status: 'available' },   // filter: must STILL be available
  { status: 'sold' },
  { new: true }
);
if (!painting) {
  // Another customer bought it between page load and clicking "Buy"
  return res.render('paintings/show', { error: 'This painting was just sold!' });
}
// Create the order...
```

**Wall booking (unique date index):**
```javascript
// In the Booking model:
bookingSchema.index({ date: 1 }, { unique: true });

// In the route handler — catch the duplicate key error:
try {
  await Booking.create({ date, wallSizeSqFt, address, customer, ... });
} catch (err) {
  if (err.code === 11000) {   // MongoDB duplicate key error
    return res.render('bookings/new', { error: 'This date is already booked!' });
  }
  throw err;
}
```

> [!TIP]
> This is the **most important technical question** they'll ask in the interview. Practice explaining the `findOneAndUpdate` atomic operation and the unique index approach — it shows you understand race conditions.

### 5.4 Business Rules Validation

| Rule | Implementation |
|------|----------------|
| Wall booking date: 7-90 days from today | Server-side check: `date >= today+7 && date <= today+90` |
| One booking per date | Unique index on `Booking.date` |
| Cancel booking: only 3+ days before | `booking.date - now >= 3 days` |
| Pottery quantity: 1-12 | Mongoose `min: 1, max: 12` + express-validator |
| Pottery needed-by: 14+ days from now | Server-side date check |
| Customer edits pottery only while `requested` | Check `request.status === 'requested'` before allowing PUT |
| Customer sees only own records | Filter queries by `customer: req.user.userId` |
| Customer asking for someone else's record | Return 404 (not 403) — as the brief specifies |

### 5.5 Three UI States (Loading / Empty / Error)

The brief explicitly requires: *"Every screen that loads data shows a loading, an empty and an error state."*

Since we use **server-side rendering (EJS)**, these states are handled slightly differently than in a React SPA:

| State | How it works |
|-------|--------------|
| **Loading** | Not really applicable with SSR — the page arrives fully rendered. But we can add a brief CSS spinner that hides once the page loads, to show we considered it |
| **Empty** | In each EJS template: `if (items.length === 0)` → show "No paintings yet" / "No bookings" message |
| **Error** | Pass `error` variable from route handler → EJS conditionally renders an alert/banner. Also, a global error-handling middleware catches unhandled errors and renders an `error.ejs` page |

### 5.6 Page-by-Page Breakdown

| Page | URL | Who sees it | What it does |
|------|-----|-------------|--------------|
| Home | `/` | Everyone | Landing page with links to paintings, booking, pottery |
| Register | `/auth/register` | Guests | Sign up form (name, email, password) |
| Login | `/auth/login` | Guests | Login form |
| Paintings Gallery | `/paintings` | Everyone | Grid of all paintings. "Available" = green. "Sold" = greyed out |
| Painting Detail | `/paintings/:id` | Everyone | Image, title, artist, description, price. Customer: "Buy" button (if available). Studio: "Edit" button |
| Add Painting | `/paintings/new` | Studio only | Form: title, artist, description, price, image URL |
| Edit Painting | `/paintings/:id/edit` | Studio only | Pre-filled form (only if painting is still available) |
| My Orders | `/orders` | Customer | List of their painting orders with cancel option |
| All Orders | `/orders` | Studio | List of ALL orders across all customers |
| Book Wall Painting | `/bookings/new` | Customer | Form: date picker (7-90 days), wall size (sq ft), address. Shows calculated price |
| My Bookings | `/bookings` | Customer | List of their bookings with status + cancel option (if 3+ days away) |
| All Bookings | `/bookings` | Studio | All bookings with Confirm/Decline buttons |
| Request Pottery | `/pottery/new` | Customer | Form: item dropdown, glaze dropdown, quantity (1-12), needed-by date |
| Edit Pottery | `/pottery/:id/edit` | Customer | Edit form (only while status is `requested`) |
| My Pottery Requests | `/pottery` | Customer | List of their requests with edit/cancel options |
| All Pottery Requests | `/pottery` | Studio | All requests with Accept/Decline buttons |

---

## 6. Learnings from Reference Websites

After browsing all five reference websites, here is what is relevant to our build:

### From Asha Art Studio
- **Clean grid layout** with product cards — image, title, price
- **Availability filters** in sidebar (In Stock / Out of Stock)
- **"Price on request"** label for custom items
- **Separate navigation sections** for Shop, Custom Orders, Wall Murals
- **Takeaway for us**: Simple card grid for paintings. Clear "Available" / "Sold" states. Separate nav items for the three services.

### From MyTribe / Nishka Art
- **Per-sq-ft pricing** displayed prominently (Rs.450/sq. ft.)
- **Location + availability info** (on-site execution, travel details)
- **"Enquire Now"** as the primary CTA
- **Takeaway for us**: Show the rate per sq ft (Rs.150 from seed data) on the booking form. Calculate and display total price dynamically as the customer enters wall size.

### From Kuprkabi Ceramic Studio
- **"OUT OF STOCK" badge** overlay on product cards — green badge
- **Ready-to-buy catalog + Custom order form** as separate pages
- **Custom order form** captures: name, contact, quantity, size, image/description
- **Takeaway for us**: Use a badge/overlay on sold paintings. Dedicated pottery request form with dropdowns for items and glazes.

### From Artgatha and Artociti
- **Clean catalog with dimensions** (in inches/feet) in product descriptions
- **Base pricing** displayed on each card
- **Custom inquiry options** alongside fixed-price items
- **Takeaway for us**: Show painting dimensions in the description. Clear price display on each card.

---

## 7. Build Plan (Adjusted for 2.5-Day Deadline)

> [!WARNING]
> The deadline is **Oct 23, 11:59 PM IST**. You have approximately 2.5 days from now (Oct 21 morning). This is a compressed plan.

### Day 1 (Oct 21) — Foundation + Auth + Paintings + Orders

**Morning (setup):**
- [ ] Initialize project: `npm init`, install all packages
- [ ] Set up Express + EJS + static files serving
- [ ] Create MongoDB Atlas free cluster and connect
- [ ] Create `.env` and `.env.example`
- [ ] Create all 5 Mongoose models (User, Painting, Order, Booking, PotteryRequest)
- [ ] Write and run the seed script (`seeds/seed.js`) — load paintings + studio account
- [ ] Build base layout (`header.ejs`, `footer.ejs`, `style.css`)

**Afternoon (auth + paintings):**
- [ ] Build auth middleware (JWT verify) + RBAC middleware
- [ ] Build auth routes (register, login, logout) + EJS pages
- [ ] Build paintings gallery page (grid of cards with Available/Sold states)
- [ ] Build single painting detail page
- [ ] Build "Buy Painting" flow with atomic `findOneAndUpdate`
- [ ] Build orders list page (customer: own / studio: all)
- [ ] Build order cancellation (painting becomes available again)

**Evening (studio features):**
- [ ] Build "Add Painting" form (studio only)
- [ ] Build "Edit Painting" form (studio only, while available)

### Day 2 (Oct 22) — Wall Booking + Pottery + All Actions

**Morning (wall booking):**
- [ ] Build wall booking form with date picker + dynamic price calculator
- [ ] Build booking creation with unique date constraint + validation (7-90 days)
- [ ] Build bookings list page (customer: own / studio: all)
- [ ] Build booking confirm/decline (studio)
- [ ] Build booking cancel (customer, 3+ days check)

**Afternoon (pottery):**
- [ ] Build pottery request form (item + glaze dropdowns, quantity 1-12, needed-by date)
- [ ] Build pottery request creation with validations (14+ days)
- [ ] Build pottery list page (customer: own / studio: all)
- [ ] Build pottery accept/decline (studio)
- [ ] Build pottery edit (customer, only while `requested`)
- [ ] Build pottery cancel (customer, only while `requested`)

**Evening (polish):**
- [ ] Add error/empty states to ALL pages
- [ ] Add flash messages for success/error feedback
- [ ] Test all RBAC combinations (wrong role = 403, not logged in = 401, other's record = 404)
- [ ] Test concurrency edge cases (two tabs buying same painting, same date)

### Day 3 (Oct 23) — Final Polish + Documentation + Submit

**Morning:**
- [ ] Test all business rules end-to-end
- [ ] Fix any remaining bugs
- [ ] Clean up CSS for consistency

**Afternoon:**
- [ ] Write `DESIGN.md` with answers to all 4 questions
- [ ] Write `README.md` with clear setup instructions
- [ ] Final code cleanup — remove console.logs, unused code

**Evening (before 11:59 PM):**
- [ ] Record 5-minute demo video (sign up, buy painting, book wall, request pottery, studio confirms)
- [ ] Upload video to Google Drive (set to "anyone with link")
- [ ] Push to GitHub (verify `.gitignore` — no `.env`)
- [ ] Verify `.env.example` has all variables with placeholders
- [ ] Submit via Google Form

---

## 8. DESIGN.md Answers (Draft)

These are the four questions from the brief. Here is how you will answer them:

### Q1: How do login and the two roles work?
> Users register with email/password. Passwords are hashed with bcrypt. On login, the server creates a JWT containing `{ userId, role }` and stores it in an HTTP-only cookie. Every request checks this cookie: no token = 401, wrong role = 403. The studio account (`studio@artstudio.in`) is pre-seeded with role `studio`. All self-registered users get role `customer`. There is no studio sign-up route.

### Q2: Which database did you choose, and why?
> MongoDB Atlas (free M0 cluster). Cloud-hosted as the brief prefers. The three services (paintings, bookings, pottery) have different shapes — MongoDB's flexible schema handles this naturally without migrations. Mongoose adds schema validation on top.

### Q3: How do you stop two people from taking the same painting or date?
> **Paintings**: `findOneAndUpdate({ _id, status: 'available' }, { status: 'sold' })` — this is atomic. If two customers click "Buy" at the same instant, only one update succeeds (the one that finds `status: 'available'`); the other gets null and sees a "just sold" message.
> **Dates**: A unique index on `Booking.date`. If two customers try to book the same date, MongoDB rejects the second insert with a duplicate key error (code 11000), which we catch and show as "this date is already booked."

### Q4: What did you finish, what did you leave out, and what would you do next?
> *(Fill this in after building — be honest about what works and what does not)*

---

## 9. Commands to Get Started

```bash
# 1. Create project
mkdir art-studio-website
cd art-studio-website
npm init -y

# 2. Install dependencies
npm install express mongoose ejs bcrypt jsonwebtoken cookie-parser express-validator dotenv method-override morgan

# 3. Install dev dependencies
npm install --save-dev nodemon

# 4. Add scripts to package.json
# "start": "node server.js"
# "dev": "nodemon server.js"

# 5. Create .env
# MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/art-studio
# JWT_SECRET=your-secret-key-here
# PORT=3000

# 6. Run seed script (after models are ready)
node seeds/seed.js

# 7. Start development
npm run dev
```

---

## 10. Interview Prep: Key Concepts to Understand

Since shortlisted candidates explain their code **live without AI**, make sure you can explain:

1. **JWT flow**: How the token is created, stored in a cookie, and verified on each request
2. **Atomic operations**: Why `findOneAndUpdate` prevents race conditions
3. **Unique indexes**: How MongoDB enforces one-booking-per-date at the database level
4. **Middleware chain**: `verifyToken → requireRole → routeHandler` — how Express middleware works
5. **MVC pattern**: Models (Mongoose), Views (EJS), Controllers (route handlers)
6. **HTTP-only cookies**: Why they are more secure than localStorage for JWT storage
7. **Status machines**: How order/booking/pottery status transitions work and why you validate them server-side

> [!CAUTION]
> **The brief says**: *"Using AI is fine. Submitting code you cannot explain is not."* As you build, understand every line. If you copy something, make sure you can explain what it does and why.
