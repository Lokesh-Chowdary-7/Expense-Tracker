const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Simple session setup
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true } 
}));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Connect to MongoDB
mongoose.connect('process.env.MONGO_URI')
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- 1. Mongoose Models ---

// User Model
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true } // Storing plain text to keep it very simple for a beginner project
});
const User = mongoose.model('User', userSchema);

// Expense Model
const expenseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['expense', 'income'], default: 'expense' },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    date: { type: Date, required: true },
    description: { type: String }
});
const Expense = mongoose.model('Expense', expenseSchema);


// --- 2. Authentication API Routes ---

// Signup Route
app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user already exists
        const exists = await User.findOne({ email });
        if (exists) {
            return res.status(400).json({ success: false, message: 'Email is already registered' });
        }

        // Create new user
        const user = new User({ name, email, password });
        await user.save();
        res.json({ success: true, message: 'Signup successful' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error during signup' });
    }
});

// Login Route
app.post('/api/login', async (req, res) => {
    try {
        const { email, password, remember } = req.body;

        // Find user by email
        const user = await User.findOne({ email });

        // Check if user exists and password matches
        if (!user || user.password !== password) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        // Set user ID in session to keep them logged in
        req.session.userId = user._id;

        // Handle "Remember Me" cookie
        if (remember) {
            res.cookie('rememberedEmail', email, { maxAge: 30 * 24 * 60 * 60 * 1000 }); // 30 days
        } else {
            res.clearCookie('rememberedEmail');
        }

        res.json({ success: true, message: 'Login successful' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
});

// Logout Route
app.post('/api/logout', (req, res) => {
    req.session.destroy(); // Destroy the session to log out
    res.json({ success: true });
});

// Get Current User Info
app.get('/api/user', async (req, res) => {
    // Check if user is logged in
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    try {
        // Find user but exclude password from the result
        const user = await User.findById(req.session.userId, '-password');
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching user' });
    }
});


// --- 3. Expense CRUD API Routes ---

// Add a new expense
app.post('/api/expenses', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    try {
        const expense = new Expense({
            ...req.body,
            userId: req.session.userId
        });
        await expense.save();
        res.json({ success: true, expense });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error adding expense' });
    }
});

// Get all expenses for the logged-in user
app.get('/api/expenses', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    try {
        const query = { userId: req.session.userId };

        // Handle optional category filtering
        if (req.query.category) {
            query.category = req.query.category;
        }
        if (req.query.type) {
            query.type = req.query.type;
        }

        // Find expenses and sort by date descending
        const expenses = await Expense.find(query).sort({ date: -1 });
        res.json({ success: true, expenses });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching expenses' });
    }
});

// Delete an expense
app.delete('/api/expenses/:id', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    try {
        await Expense.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting expense' });
    }
});

// Update/Edit an expense
app.put('/api/expenses/:id', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    try {
        const expense = await Expense.findOneAndUpdate(
            { _id: req.params.id, userId: req.session.userId },
            req.body,
            { new: true } // Return the updated document
        );
        res.json({ success: true, expense });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating expense' });
    }
});

// Provide a dummy contact API for Help/Support page
app.post('/api/contact', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    // In a real app this would send an email
    res.json({ success: true, message: 'Message sent successfully!' });
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
