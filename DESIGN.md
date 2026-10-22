# DESIGN.md — System Architecture & Design Decisions

> *Architecture Documentation & System Design Specifications*

---

### 1. How do login and the two roles work?

The application implements a stateless, token-based authentication system backed by **JSON Web Tokens (JWT)** and **HTTP-only cookies**:

- **Password Security:** All passwords are salted and hashed using `bcrypt` (10 salt rounds) before persistence in MongoDB. Plaintext passwords never touch the database.
- **Token Delivery:** Upon successful authentication (`/auth/login` or `/auth/register`), the server generates a signed JWT containing `{ userId, email, role, name }` with a 7-day expiration. The token is transmitted via an `httpOnly: true`, `sameSite: 'lax'` cookie. This completely shields the token from JavaScript access, eliminating XSS token theft risks compared to `localStorage`.
- **RBAC Enforcement:**
  - `checkUser` middleware runs globally on every request, populating `res.locals.currentUser` for role-aware navbar rendering.
  - `verifyToken` middleware guards protected routes: unauthenticated requests receive an HTTP `401 Unauthorized` redirect.
  - `requireRole(...allowedRoles)` middleware strictly enforces permission boundaries: unauthorized role access triggers an HTTP `403 Forbidden` response.
- **Account Provisioning:**
  - **Customer:** Any user can self-register via `/auth/register`. The server enforces `role: 'customer'` on all self-registered accounts.
  - **Studio Admin:** As specified in the brief's "Out of Scope" guidelines, there is no public studio registration endpoint. The studio account (`studio@artstudio.in`) is securely pre-provisioned via our database seed script (`npm run seed`) with `role: 'studio'`.
- **Privacy & Security Masking:** When a customer attempts to query or manipulate another customer's order, booking, or request by guessing record IDs in URLs, the server returns **`404 Not Found`** instead of `403 Forbidden`, preventing resource enumeration attacks.

---

### 2. Which database did you choose, and why?

We chose **MongoDB (with Mongoose ODM)**:

- **Heterogeneous Domain Schemas:** The studio manages three distinct workflows with dissimilar data shapes:
  1. *Paintings:* One-of-a-kind art pieces with image assets and binary inventory statuses (`available`, `sold`).
  2. *Wall Murals:* On-site calendar bookings with date constraints, area dimensions (10–500 sq. ft.), and dynamic rate calculations.
  3. *Custom Pottery:* Multi-attribute batch requests referencing items (Kulhad, Surahi, etc.), artisanal glazes (Kumkum Red, Indigo Blue, etc.), and multi-step approval lifecycles.  
  MongoDB’s flexible document model handles these varied entity structures without requiring cumbersome multi-table relational migrations.
- **Atomic Operations for Concurrency:** MongoDB provides native atomic primitives (`findOneAndUpdate`, unique partial filter indexes) that allow us to guarantee race-condition immunity without heavy distributed locks.
- **Cloud-Ready Compatibility:** MongoDB seamlessly operates both locally (`mongodb://localhost:27017/art_studio`) during rapid offline development and on MongoDB Atlas (free tier M0 cluster) for production evaluation, satisfying the evaluators' preference for cloud-hosted databases without altering application code.

---

### 3. How do you stop two people from taking the same painting or date?

Preventing double-allocation is solved at the **database layer** through two distinct concurrency patterns:

#### A. Original Paintings (Atomic Compare-And-Swap)
Each painting is unique and can only be acquired once. Rather than a naive two-step read-then-write (`findById` followed by `save()`, which creates a critical race condition window), we execute an **atomic `findOneAndUpdate`**:

```javascript
const painting = await Painting.findOneAndUpdate(
  { _id: paintingId, status: 'available' }, // Filter ensures it is STILL available
  { status: 'sold' },                       // Atomic transition
  { returnDocument: 'after' }
);

if (!painting) {
  // If another customer acquired it milliseconds earlier, the atomic filter returns null
  return res.status(409).render('error', {
    title: 'Painting Unavailable',
    statusCode: 409,
    message: 'Refused: This one-of-a-kind painting was just sold to another customer!'
  });
}
```
MongoDB's single-document atomicity guarantees that even if dozens of concurrent requests arrive simultaneously, only **one** transaction successfully updates the document; all concurrent requests receive `null` and a user-friendly refusal message.

#### B. Wall Mural Booking Dates (Partial Filter Unique Indexes)
For wall murals, each calendar date can be booked at most once. We enforce this using a **MongoDB Partial Unique Index**:

```javascript
bookingSchema.index(
  { dateString: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['requested', 'confirmed'] } }
  }
);
```
- **Collision Protection:** When two customers attempt to book the same date simultaneously, MongoDB's index engine atomically rejects the second write with duplicate key error `code: 11000`. The server catches this error and presents a clear conflict message: *"Refused: The date is already booked! Please pick another date."*
- **Re-booking Capability:** Because the index applies only to active statuses (`requested`, `confirmed`), if an existing booking is `cancelled` or `declined`, the date automatically frees up for other collectors without manual database intervention.

---

### 4. What did you finish, what did you leave out, and what would you do next?

#### What We Finished (100% of Core Brief Scope):
- **Authentication & RBAC:** Full customer signup, login, cookie logout, role-based view rendering, and strict middleware route guards (401, 403, and 404 security masking).
- **Service 1 — Paintings & Orders:** Full catalog browsing (12 pre-seeded artworks), status filtering (All, Available, Sold), painting detail views, atomic concurrency purchase checkout, order listings, and order cancellation with automatic gallery availability restoration.
- **Service 2 — Wall Murals:** Booking form with dynamic client-side area calculator (`₹150/sq. ft.`), calendar bounds enforcement (7 to 90 days), unique date collision prevention, studio Confirm/Decline dashboard, and customer cancellation cutoff ($\ge 3$ days before execution).
- **Service 3 — Custom Pottery:** Custom order flow with seed vessels and glazes, quantity limits (1–12), 14-day lead-time enforcement for kiln firing, studio Accept/Decline management, and customer edit/cancel restrictions (strictly permitted only while `requested`).
- **UI States:** Loading, empty, and conflict/error feedback across every screen.

#### What We Left Out (Deliberately Out of Scope):
In strict adherence to **Section 06 (What you do not need to build)** of the brief, we did not waste time on:
- Real payment gateways (buying directly records an order).
- Password resets, email verification, social OAuth logins, or studio signups.
- Delivery tracking, reviews, coupons, or SMS/email notifications.
- Heavy front-end framework bloat (avoided React/Vite overhead to keep code 100% verifiable and fast).

#### What We Would Do Next (Future Roadmap):
1. **Interactive Mural Visualizer:** Let customers upload an image of their living room wall and preview mural placement with augmented dimension scaling.
2. **Pottery Kiln Batch Tracker:** Provide a visual timeline showing firing stages (bisque fire $\rightarrow$ glaze application $\rightarrow$ final high-fire) for accepted pottery requests.
3. **Automated Calendar ICS Feeds:** Allow studio artists to subscribe to confirmed wall mural dates via Google Calendar.
