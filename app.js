const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const path = require('path');
const app = express();

// DB Setup
const db = mysql.createConnection({
    host: 'abu3sk.h.filess.io',
    port: 3307,
    user: 'Team42_packrubber',
    password: '2f1da853f4e10bb5f6d4120b7051f68ffd3d78ac',
    database: 'Team42_packrubber',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
db.connect(err => {
    if (err) throw err;
    console.log("Connected to DB");
});

// Multer config (upload to /public/images/)
const storage = multer.diskStorage({
    destination: 'public/images/',
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true
}));
app.use(flash());
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Auth middleware
function checkAuthenticated(req, res, next) {
    if (req.session.user) return next();
    req.flash('error', 'Please log in');
    res.redirect('/login');
}
function checkAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') return next();
    req.flash('error', 'Admins only');
    res.redirect('/dashboard');
}

// Routes
app.get('/', (req, res) => {
    res.render('index', { messages: [] });
});

app.get('/register', (req, res) => {
    res.render('register', {
        errors: req.flash('error'),
        success: req.flash('success'),
        formData: req.flash('formData')[0] || {}
    });
});

app.post('/register', (req, res) => {
    const { username, email, password, address, contact, role } = req.body;

    if (!username || !email || !password || !address || !contact || !role) {
        req.flash('error', 'All fields are required.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }

    if (password.length < 6) {
        req.flash('error', 'Password must be at least 6 characters.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }

    const insertSQL = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    db.query(insertSQL, [username, email, password, address, contact, role], (err) => {
        if (err) {
            console.error('Registration error:', err);
            req.flash('error', 'Registration failed. Please try again.');
            req.flash('formData', req.body);
            return res.redirect('/register');
        }

        req.flash('success', 'Registration successful. You can now log in.');
        res.redirect('/login');
    });
});

app.get('/login', (req, res) => {
    res.render('login', { errors: req.flash('error'), messages: req.flash('success') });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
            req.session.user = results[0];
            res.redirect('/dashboard');
        } else {
            req.flash('error', 'Invalid credentials');
            res.redirect('/login');
        }
    });
});

app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard', {
        user: req.session.user,
        messages: req.flash('success').concat(req.flash('error'))
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// 🥿 View shoe inventory
app.get('/shoes', checkAuthenticated, (req, res) => {
    db.query('SELECT * FROM Product', (err, results) => {
        if (err) throw err;
        res.render('shoeList', { shoes: results, user: req.session.user });
    });
});

// Add Shoe page
app.get('/addshoe', checkAdmin, (req, res) => {
  res.render('addShoe');
});

// Handle Add Shoe POST
app.post('/addshoe', checkAdmin, upload.single('image'), (req, res) => {
  const { productName, brand, size, price, quantity } = req.body;
  const image = req.file ? req.file.filename : null;

  const sql = 'INSERT INTO Product (productName, brand, size, price, quantity, image) VALUES (?, ?, ?, ?, ?, ?)';
  db.query(sql, [productName, brand, size, price, quantity, image], (err) => {
    if (err) {
      console.error(err);
      return res.send('Error adding shoe');
    }
    res.redirect('/shoes');
  });
});

app.get('/viewshoe/:id', checkAuthenticated, (req, res) => {
    const shoeId = req.params.id;
    db.query('SELECT * FROM Product WHERE productID = ?', [shoeId], (err, results) => {
        if (err) throw err;
        if (results.length === 0) return res.send('Shoe not found.');
        res.render('viewshoe', { shoe: results[0] });
    });
});

// ✏️ Edit shoe
app.get('/editshoe/:id', checkAdmin, (req, res) => {
  const shoeId = req.params.id;
  db.query('SELECT * FROM Product WHERE productID = ?', [shoeId], (err, results) => {
    if (err) throw err;
    if (results.length === 0) return res.send('Shoe not found.');
    res.render('editShoe', { shoe: results[0] });
  });
});

app.post('/editshoe/:id', checkAdmin, upload.single('image'), (req, res) => {
  const shoeId = req.params.id;
  const { productName, brand, size, price, quantity, existingImage } = req.body;
  let image = existingImage;
  if (req.file) {
    image = req.file.filename;
  }
  const sql = 'UPDATE Product SET productName=?, brand=?, size=?, price=?, quantity=?, image=? WHERE productID=?';
  const values = [productName, brand, size, price, quantity, image, shoeId];

  db.query(sql, values, (err) => {
    if (err) {
      console.error("Update error:", err);
      return res.send("Error updating shoe.");
    }
    res.redirect('/shoes');
  });
});

// 🗑️ Delete shoe
app.get('/deleteshoe', checkAuthenticated, checkAdmin, (req, res) => {
  const id = req.query.id;
  db.query('DELETE FROM Product WHERE productID = ?', [id], (err) => {
    if (err) throw err;
    res.redirect('/shoes');
  });
});

// Start
app.listen(3000, () => console.log('Server running on http://localhost:3000'));
