const express = require('express');
const mysql = require('mysql2');

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

    if (!username || !email || !password || !address || !contact) {
        return res.status(400).send('All fields are required.');
    }
    
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};


//******** TODO: Integrate validateRegistration into the register route. ********//
app.post('/register', validateRegistration, (req, res) => {
    //******** TODO: Update register route to include role. ********//
    const { username, email, password, address, contact, role} = req.body;

    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    db.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
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

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length > 0) {
            // Successful login
            req.session.user = results[0]; // store user in session
            req.flash('success', 'Login successful!');
            //******** TO DO: Update to redirect users to /dashboard route upon successful log in ********//
            res.redirect('/dashboard');
        } else {
            // Invalid credentials
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

// Edit shoe
app.get('/edit', checkAuthenticated, checkAdmin, (req, res) => {
    const id = req.query.id;
    const sql = 'SELECT * FROM Product WHERE productID = ?';
    db.query(sql, [id], (err, results) => {
        if (err) throw err;
        res.render('editShoe', { shoe: results[0], user: req.session.user });
    });
});

app.post('/edit', upload.single('image'), (req, res) => {
    const { productID, productName, brand, size, price, quantity, currentImage } = req.body;
    const image = req.file ? req.file.filename : currentImage;
    const sql = 'UPDATE Product SET productName=?, brand=?, size=?, price=?, quantity=?, image=? WHERE productID = ?';
    db.query(sql, [productName, brand, size, price, quantity, image, productID], (err) => {
        if (err) throw err;
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

app.post('/deleteItem', (req, res) => {
    const itemId = req.body.itemId;
    const sql = "DELETE FROM items WHERE itemId = ?";

    db.query(sql, [itemId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error deleting item');
        }
        res.redirect('/list'); // Redirect to your list page after delete
    });
});

app.post('/addItem', (req, res) => {
    const { movieName, userName, rating, comment } = req.body;
    const sql = "INSERT INTO movie_reviews (movieName, userName, rating, comment) VALUES (?, ?, ?, ?)";

    db.query(sql, [movieName, userName, rating, comment], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error adding review');
        }
        res.redirect('/reviews'); // Redirect to reviews page
    });
});


app.get('/reviews', (req, res) => {
    const sql = "SELECT * FROM movie_reviews ORDER BY created_at DESC";
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error fetching reviews');
        }
        res.render('reviews', { reviews: results });
    });
});




// Starting the server
app.listen(3000, () => {
    console.log('Server started on port 3000');
});
