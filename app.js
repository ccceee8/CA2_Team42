const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');

//******** TODO: Insert code to import 'express-session' *********//
const session = require('express-session');

const flash = require('connect-flash');

const app = express();

// Database connection
const db = mysql.createConnection({
    host: '4z4teu.h.filess.io',
    port: 3307,
    user: 'CA2Team42_becominghe',
    password: '1cfb3a4630efc53c244937a89228ace23042d725',
    database: 'CA2Team42_becominghe'
});

db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to database');
});

app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

//******** TODO: Insert code for Session Middleware below ********//
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: {maxAge: 1000 * 60 * 60 * 24 * 7}
}));

app.use(flash());

// Setting up EJS
app.set('view engine', 'ejs');

//******** TODO: Create a Middleware to check if user is logged in. ********//
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

//******** TODO: Create a Middleware to check if user is admin. ********//
const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/dashboard');
    }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads'); // Ensure this directory exists
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Routes
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user, messages: req.flash('success')});
});

app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});


//******** TODO: Create a middleware function validateRegistration ********//
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact } = req.body;

    // Check if all required fields are present
    if (!username || !email || !password || !address || !contact) {
        req.flash('error', 'All fields are required.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        req.flash('error', 'Please enter a valid email address.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }

    // Validate password
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }

    // Validate username length
    if (username.length < 3) {
        req.flash('error', 'Username should be at least 3 characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }

    next();
};


//******** TODO: Integrate validateRegistration into the register route. ********//
app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role = 'user' } = req.body; // Default role to 'user'

    // First check if email already exists
    const checkEmailSql = 'SELECT email FROM users WHERE email = ?';
    db.query(checkEmailSql, [email], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            req.flash('error', 'An error occurred during registration.');
            req.flash('formData', req.body);
            return res.redirect('/register');
        }

        if (results.length > 0) {
            req.flash('error', 'Email already registered. Please use a different email.');
            req.flash('formData', req.body);
            return res.redirect('/register');
        }

        // If email doesn't exist, proceed with registration
        const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
        db.query(sql, [username, email, password, address, contact, role], (err, result) => {
            if (err) {
                console.error('Database error:', err);
                req.flash('error', 'An error occurred during registration.');
                req.flash('formData', req.body);
                return res.redirect('/register');
            }
            
            console.log('User registered:', email);
            req.flash('success', 'Registration successful! Please log in.');
            res.redirect('/login');
        });
    });
});

//******** TODO: Insert code for login routes to render login page below ********//
app.get('/login', (req, res) => {
    res.render('login', { 
        messages: req.flash('success'), 
        errors: req.flash('error') 
    });
});

//******** TODO: Insert code for login routes for form submission below ********//
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        req.flash('error', 'Please enter a valid email address.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    try {
        db.query(sql, [email, password], (err, results) => {
            if (err) {
                console.error('Database error:', err);
                req.flash('error', 'An error occurred during login. Please try again.');
                return res.redirect('/login');
            }

            if (results.length > 0) {
                // Successful login
                req.session.user = results[0]; // store user in session
                req.flash('success', 'Login successful!');
                res.redirect('/dashboard');
            } else {
                // Invalid credentials
                req.flash('error', 'Invalid email or password.');
                res.redirect('/login');
            }
        });
    } catch (error) {
        console.error('Server error:', error);
        req.flash('error', 'An unexpected error occurred. Please try again.');
        res.redirect('/login');
    }
});


// Edit shoe
app.post('/edit', upload.single('image'), (req, res) => {
    const { productID, productName, brand, size, price, quantity, currentImage } = req.body;
    const image = req.file ? req.file.filename : currentImage;

    // Validate input fields
    if (!productID || !productName || !brand || !size || !price || !quantity) {
        req.flash('error', 'All fields are required');
        return res.redirect(`/edit?id=${productID}`);
    }

    const sql = 'UPDATE Product SET productName=?, brand=?, size=?, price=?, quantity=?, image=? WHERE productID = ?';
    db.query(sql, [productName, brand, size, price, quantity, image, productID], (err) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Error updating product');
            return res.redirect(`/edit?id=${productID}`);
        }
        req.flash('success', 'Product updated successfully');
        res.redirect('/shoes');
    });
});

//******** TODO: Insert code for dashboard route to render dashboard page for users. ********//
app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});

//******** TODO: Insert code for admin route to render dashboard page for admin. ********//
app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin', { user: req.session.user });
});

//******** TODO: Insert code for logout route ********//
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Delete shoes 
app.post('/deleteItem', (req, res) => {
    const itemId = req.body.itemId;
    const sql = "DELETE FROM shoe_reviews WHERE itemId = ?";

    db.query(sql, [itemId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error deleting review');
        }
        res.redirect('/shoeList'); 
    });
});

// Add a new shoe review
app.post('/addItem', (req, res) => {
    const { shoeName, userName, rating, comment } = req.body;
    const sql = "INSERT INTO shoe_reviews (shoeName, userName, rating, comment) VALUES (?, ?, ?, ?)";

    db.query(sql, [productName, brand, size, comment], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error adding review');
        }
        res.redirect('/review');
    });
});

// Get all shoe reviews
app.get('/reviews', (req, res) => {
    const sql = "SELECT * FROM shoe_reviews ORDER BY created_at DESC";
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error fetching reviews');
        }
        res.render('reviews', { review: results });
    });
});

// View a single shoe by ID
app.get('/shoe/:id', checkAuthenticated, (req, res) => {
    const shoeId = parseInt(req.params.id, 10);
    if (Number.isNaN(shoeId)) {
        return res.status(400).send('Invalid shoe ID');
    }

    const sql = 'SELECT * FROM Product WHERE productID = ?';
    db.query(sql, [shoeId], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }

        if (results.length === 0) {
            return res.status(404).send('Shoe not found');
        }

        res.render('shoe', {
            shoe: results[0],
            user: req.session.user,
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    });
});


// Starting the server
app.listen(3000, () => {
    console.log('Server started on port 3000');
});
