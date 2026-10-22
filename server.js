require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const methodOverride = require('method-override');

const connectDB = require('./config/db');
const { checkUser } = require('./middleware/auth');

// Initialize app
const app = express();

// Connect to Database
connectDB();

// View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(path.join(__dirname, 'img')));

// Global user state & flash messages on res.locals
app.use(checkUser);

// Home route
app.get('/', (req, res) => {
  res.render('home', { title: 'Art Studio - Home' });
});

// Auth Routes
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// Paintings & Orders Routes
const paintingsRoutes = require('./routes/paintings');
app.use('/paintings', paintingsRoutes);

const ordersRoutes = require('./routes/orders');
app.use('/orders', ordersRoutes);

// Wall Murals Bookings Routes
const bookingsRoutes = require('./routes/bookings');
app.use('/bookings', bookingsRoutes);

// Custom Pottery Routes
const potteryRoutes = require('./routes/pottery');
app.use('/pottery', potteryRoutes);

// 404 Not Found Handler
app.use((req, res, next) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    statusCode: 404,
    message: 'The page or record you requested could not be found.'
  });
});

// Global 500 Error Handler
app.use((err, req, res, next) => {
  console.error('[Global Error]:', err.stack);
  res.status(500).render('error', {
    title: 'Internal Server Error',
    statusCode: 500,
    message: 'An unexpected error occurred on the server. Please try again shortly.'
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Art Studio] Server running on http://localhost:${PORT}`);
});
