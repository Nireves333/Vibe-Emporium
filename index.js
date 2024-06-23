const express = require('express');
const app = express();
const https = require('https');
const pool = require('./dbPool');
const session = require('express-session');
const Decimal = require('decimal.js');

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'top-secret!',
  resave: true,
  saveUninitialized: true
}));

// VARIABLES
// Nookipedia API for villagers
const base_url = 'https://api.nookipedia.com';
const endpoint = `/villagers?game=nh`;
const api_version = '1.6.0';
const api_key = '23580675-0ee9-44bd-836b-18ec963d0ae7';
const headers = {
  'X-API-KEY': api_key,
  'Accept-Version': api_version
};


// FUNCTIONS

// Middleware to check session status
function checkSessionStatus(req, res) {
  const isAuthenticated = req.session.authenticated || false;
  const user = req.session.user || null;

  res.locals.logoutButtonVisible = isAuthenticated;
  res.locals.user = user;
}

// Function to convert a string to title case
function toTitleCase(str) {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

// Function to fetch API data
const fetchAPIData = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (apiRes) => {
      let data = '';

      // Add data chunks
      apiRes.on('data', (chunk) => {
        data += chunk;
      });

      // After all data is received, try to parse the data
      apiRes.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch (error) {
          // Reject if there is an error parsing
          reject(error);
        }
      });
    }).on('error', (error) => {
      // Reject if there is an error with the request
      reject(error);
    });
  });
};

// Function to fetch and process furniture menu
const fetchFurnitureMenu = async () => {
  // const apiUrl = `https://acnhapi.com/v1a/houseware/`;
  const apiUrl = `https://raw.githubusercontent.com/and1cam/ACNHAPI/master/v1a/houseware.json`;

  // Try to fetch data
  try {
    const response = await fetchAPIData(apiUrl);

    // Create sets to store unique values
    const conceptsSet = new Set();
    const seriesSet = new Set();
    const setSet = new Set();

    // Iterate through the API response and add unique values
    Object.values(response).forEach((array) => {
      array.forEach((item) => {
        if (item['hha-concept-1'] !== null) {
          conceptsSet.add(toTitleCase(item['hha-concept-1']));
        }
        if (item['hha-series'] !== null) {
          seriesSet.add(toTitleCase(item['hha-series']));
        }
        if (item['hha-set'] !== null) {
          setSet.add(toTitleCase(item['hha-set']));
        }
      });
    });

    // Convert sets to arrays
    const concepts = Array.from(conceptsSet);
    const series = Array.from(seriesSet);
    const sets = Array.from(setSet);

    // Return sets
    return { concepts, series, sets };

  } catch (error) {
    // Catch if there's an error during the fetching or processing
    console.error('Error fetching furniture menu:', error.message);
  }
};

async function fetchVillagerTraits() {
  try {
    // Fetch data for the villagers
    const response = await fetch(base_url + endpoint, { headers });
    const data = await response.json();

    // Extract unique species, personalities, and signs from the data
    const speciesList = [...new Set(data.map((villager) => villager.species))];
    const personalities = [...new Set(data.map((villager) => villager.personality))];
    const signs = [...new Set(data.map((villager) => villager.sign))];

    return {
      speciesList,
      personalities,
      signs,
    };
  } catch (error) {
    console.error('Error fetching villager traits:', error);
    return {
      speciesList: [],
      personalities: [],
      signs: [],
    };
  }
}

// Function to fetch items with each order
async function getItemsForOrders(orders) {
  const orderIDs = orders.map(order => order.orderID);
  const sql = `SELECT * FROM items WHERE orderID IN (?)`;
  const rows = await executeSQL(sql, [orderIDs]);
  const itemsByOrder = {};

  // Group the items by orderID
  rows.forEach(item => {
    if (!itemsByOrder[item.orderID]) {
      itemsByOrder[item.orderID] = [];
    }
    itemsByOrder[item.orderID].push({
      ...item,
      price: (parseFloat(item.price)).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
      }),
    });
  });

  return itemsByOrder;
}

// ROUTES

// Route to handle the homepage
app.get('/', async (req, res) => {
  checkSessionStatus(req, res);
  // Fetch data for the furniture menu
  const { concepts, series, sets } = await fetchFurnitureMenu();

  // Check if user is already logged in
  if (req.session.authenticated) {
    let villagerImage = req.session.user.villagerImage;
    let villagerName = req.session.user.villager;

    res.render('index', { villagerImage, villagerName, concepts, series, sets });
  } else {

    // Generate random month and day
    let rndMonth = Math.floor(Math.random() * 13);
    let rndDay = Math.floor(Math.random() * 32);

    // Nookipedia API (Villagers)
    let endpoint = `/villagers?game=nh&birthmonth=${rndMonth}&birthday=${rndDay}`;
    // Fetch data from Nookipedia API
    let response = await fetch(base_url + endpoint, { headers });
    let data = await response.json();

    // Keep generating a random date until a valid villager is found
    while (typeof data === 'undefined' ||
      !Array.isArray(data) ||
      data.length < 1 ||
      typeof data[0].image_url === 'undefined') {
      rndMonth = Math.floor(Math.random() * 13);
      rndDay = Math.floor(Math.random() * 32);
      endpoint = `/villagers?game=nh&birthmonth=${rndMonth}&birthday=${rndDay}`;
      response = await fetch(base_url + endpoint, { headers });
      data = await response.json();
    }

    // Extract the information from the fetched data
    let villagerImage = data[0].image_url;
    let villagerName = data[0].name;

    // Render the view and pass the fetched data
    res.render('index', { villagerImage, villagerName, concepts, series, sets });
  }
});

// Route to handle the account link
app.get('/account', async (req, res) => {
  checkSessionStatus(req, res);
  // Fetch data for the furniture menu
  const { concepts, series, sets } = await fetchFurnitureMenu();
  // Fetch data for the shopping assistants (villagers) dropdown
  let response = await fetch(base_url + endpoint, { headers });
  let villagers = await response.json();

  // Check if user is authenticated
  if (req.session.authenticated) {
    let villagerImage = req.session.user.villagerImage;
    let villagerName = req.session.user.villager;
    let villagerQuote = req.session.user.villagerQuote;
    // If authenticated, reneder account page
    res.render('account', { "updateSuccess": false, villagerImage, villagerName, villagerQuote, villagers, concepts, series, sets });
  } else {
    // If not authenicated, redirects to login page
    res.redirect('/login');
  }
});

// Handle the POST request for the account page
app.post('/account', async function(req, res) {
  checkSessionStatus(req, res);
  // Fetch data for the furniture menu
  const { concepts, series, sets } = await fetchFurnitureMenu();
  // Fetch data for the shopping assistants (villagers) dropdown
  let response = await fetch(base_url + endpoint, { headers });
  let villagers = await response.json();

  // Get user data and inputs
  let userID = req.session.user.userID;
  let password = req.body.password;
  let villager = req.body.villager;
  let subscribe = req.body.subscribe;
  let tempSubscribe = subscribe;
  if (tempSubscribe) {
    tempSubscribe = 1;
  } else {
    tempSubscribe = 0;
  }

  // Update user information in the database
  let sql = 'UPDATE users SET password = ?, villager = ?, subscribe = ? WHERE userID = ?';
  let params = [password, villager, tempSubscribe, userID];
  let rows = await executeSQL(sql, params);

  // Nookipedia API (Villagers)
  let endpoint2 = `/villagers?game=nh&name=${villager}`;
  // Fetch data from Nookipedia API
  let response2 = await fetch(base_url + endpoint2, { headers });
  let data2 = await response2.json();

  // Update the user information in the session
  req.session.user.password = password;
  req.session.user.villager = villager;
  req.session.user.subscribe = tempSubscribe;
  req.session.user.villagerImage = data2[0].image_url;
  req.session.user.villagerQuote = data2[0].quote;

  let villagerImage = req.session.user.villagerImage;
  let villagerName = req.session.user.villager;
  let villagerQuote = req.session.user.villagerQuote;

  // Render the view and pass the fetched data
  return res.render('account', { "updateSuccess": true, villagerImage, villagerName, villagerQuote, villagers, concepts, series, sets });
});

// Route to handle the login page
app.get('/login', async (req, res) => {
  checkSessionStatus(req, res);
  // Fetch data for the furniture menu
  const { concepts, series, sets } = await fetchFurnitureMenu();
  // Render the view and pass the fetched data
  res.render('login', { "loginError": false, concepts, series, sets });
});

// Handle the POST request for the login page
app.post('/login', async function(req, res) {
  checkSessionStatus(req, res);
  // Fetch data for the furniture menu
  const { concepts, series, sets } = await fetchFurnitureMenu();

  // Get input fields and initialize variables
  let username = req.body.usernameInput;
  let password = req.body.passwordInput;
  let checkPassword = "";

  // SQL query to get user data
  let sql = "SELECT * FROM users WHERE username = ?";
  let params = [username];
  let rows = await executeSQL(sql, params);
  // Check if input username exists
  if (rows.length > 0) {
    // If the user exists, store their password
    checkPassword = rows[0].password;
  }

  // Compare the input password with the stored password
  if (password.length > 0 && password == checkPassword) {
    // Nookipedia API (Villagers)
    let endpoint = `/villagers?game=nh&name=${rows[0].villager}`;
    // Fetch data from Nookipedia API
    let response = await fetch(base_url + endpoint, { headers });
    let data = await response.json();

    // If the passwords match, authenticate user
    req.session.authenticated = true;
    req.session.user = {
      // Store relevant user data in the session
      userID: rows[0].userID,
      username: rows[0].username,
      password: rows[0].password,
      villager: rows[0].villager,
      villagerImage: data[0].image_url,
      villagerQuote: data[0].quote,
      subscribe: rows[0].subscribe
    };
    // Redirect the user to the account page
    return res.redirect('/account');
  } else {
    // Render the view and pass the fetched data
    return res.render('login', { "loginError": true, concepts, series, sets });
  }
});

// Route to handle the new account page
app.get('/newAccount', async (req, res) => {
  checkSessionStatus(req, res);
  // Fetch data for the furniture menu
  const { concepts, series, sets } = await fetchFurnitureMenu();
  // Fetch data for the shopping assistants (villagers) dropdown
  let response = await fetch(base_url + endpoint, { headers });
  let villagers = await response.json();

  // Render the view and pass the fetched data
  res.render('newAccount', { "createError": false, villagers, concepts, series, sets });
});

// Handle the POST request for the new account page
app.post('/account/new', async function(req, res) {
  checkSessionStatus(req, res);
  // Fetch data for the furniture menu
  const { concepts, series, sets } = await fetchFurnitureMenu();
  // Fetch data for the shopping assistants (villagers) dropdown
  let response = await fetch(base_url + endpoint, { headers });
  let villagers = await response.json();

  // Get user input from the form
  let username = req.body.username;
  let password = req.body.password;
  let villager = req.body.villager;
  let subscribe = req.body.subscribe;
  // Convert subscribe to 0 (false) or 1 (true)
  if (subscribe) {
    subscribe = 1;
  } else {
    subscribe = 0;
  }

  // Check if the username already exists in the database
  let checkUsernameSQL = "SELECT * FROM users WHERE username = ?";
  let checkUsernameParams = [username];
  let existingUser = await executeSQL(checkUsernameSQL, checkUsernameParams);
  if (existingUser.length > 0) {
    // Username already exists, return an error response
    return res.render('newAccount', { "createError": true, villagers, concepts, series, sets });
  } else {
    // Username does not exist, proceed with inserting the new user
    let insertUserSQL = `INSERT INTO users (username, password, villager, subscribe) VALUES (?, ?, ?, ?)`;
    let insertUserParams = [username, password, villager, subscribe];
    await executeSQL(insertUserSQL, insertUserParams);

    // Fetch the newly inserted user from the database
    let fetchUserSQL = "SELECT * FROM users WHERE username = ?";
    let fetchUserParams = [username];
    let newUser = await executeSQL(fetchUserSQL, fetchUserParams);
    if (newUser.length > 0) {
      checkPassword = newUser[0].password;
    }

    // Nookipedia API (Villagers)
    let endpoint2 = `/villagers?game=nh&name=${villager}`;
    // Fetch data from Nookipedia API
    let response2 = await fetch(base_url + endpoint2, { headers });
    let data = await response2.json();

    // Set session variables for the authenticated user
    req.session.authenticated = true;
    req.session.user = {
      userID: newUser[0].userID,
      username: newUser[0].username,
      password: newUser[0].password,
      villager: newUser[0].villager,
      villagerImage: data[0].image_url,
      villagerQuote: data[0].quote,
      subscribe: newUser[0].subscribe
    };

    console.log("Villager URL: ", req.session.user.villagerImage);
    console.log("Villager Name: ", req.session.user.villager);
    console.log("Villager Quote: ", req.session.user.villagerQuote);

    // Redirect to the account page
    return res.redirect('/account');
  }
});

// Route to handle the furniture page
app.get('/furniture/:category', async (req, res) => {
  checkSessionStatus(req, res);
  // const apiUrl = `https://acnhapi.com/v1a/houseware/`;
  const apiUrl = `https://raw.githubusercontent.com/and1cam/ACNHAPI/master/v1a/houseware.json`;
  // Extract the category from the request parameters
  const selectedCategory = req.params.category.toLowerCase();
  // Extract the page number from the query parameters
  const currentPage = parseInt(req.query.page) || 1;
  const itemsPerPage = 12;

  try {
    // Fetch data for the furniture menu
    const { concepts, series, sets } = await fetchFurnitureMenu();
    // Fetch additional furniture data
    const response = await fetchAPIData(apiUrl);

    // Initialize arrays to store furniture information
    const items = [];
    const names = [];
    const prices = [];
    const images = [];

    // Iterate through the API response and filter items
    Object.values(response).forEach((array) => {
      array.forEach((item) => {
        if ((item['hha-concept-1'] === selectedCategory
          || item['hha-series'] === selectedCategory
          || item['hha-set'] === selectedCategory)
          && !items.includes(item['internal-id'])) {
          // If the item matches the selectedCategory
          // and is not already included,
          // add it to the arrays
          items.push(item['internal-id']);
          names.push(toTitleCase(item.name['name-USen']));
          prices.push(item['sell-price']);
          const modifiedImageURL = `https://raw.githubusercontent.com/and1cam/ACNHAPI/master/images/furniture/${item['file-name']}.png`;
          images.push(modifiedImageURL);
        }
      });
    });

    // Calculate pagination information
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Get the items to be displayed on the current page
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = items.slice(startIndex, endIndex);
    const paginatedNames = names.slice(startIndex, endIndex);
    const paginatedPrices = prices.slice(startIndex, endIndex);
    const paginatedUrls = images.slice(startIndex, endIndex);

    // Render the view and pass the fetched data
    res.render('furniture', {
      selectedCategory,
      concepts,
      series,
      sets,
      items: paginatedItems,
      names: paginatedNames,
      prices: paginatedPrices,
      images: paginatedUrls,
      currentPage,
      totalPages,
    });
  } catch (error) {
    // Catch if there's an error during the fetching or processing
    console.error('Error fetching furniture data:', error.message);
  }
});

// Route to render villager page
const villagers_per_page = 12;
app.get('/villagers', async (req, res) => {
  checkSessionStatus(req, res);
  // Fetch data for the furniture menu & villager traits
  const { concepts, series, sets } = await fetchFurnitureMenu();
  const { speciesList, personalities, signs } = await fetchVillagerTraits();

  let page = parseInt(req.query.page) || 1;

  // fetches the combined URL with apropiate headers
  let response = await fetch(base_url + endpoint, { headers });
  let data = await response.json();

  // Determines how many pages to create
  let totalVillagers = data.length;
  let totalPages = Math.ceil(totalVillagers / villagers_per_page);
  let indexStart = (page - 1) * villagers_per_page;
  let indexEnd = indexStart + villagers_per_page;
  let paginatedVillagers = data.slice(indexStart, indexEnd);

  // Render all villager information
  res.render('villagers', {
    villagers: paginatedVillagers.map(villager => {
      return {
        imageUrl: villager.image_url,
        name: villager.name,
        species: villager.species,
        personality: villager.personality,
        sign: villager.sign,
        quote: villager.quote,
        phrase: villager.phrase
      };
    }),
    currentPage: page, totalPages: totalPages,
    concepts, series, sets,
    speciesList, personalities, signs
  });
});

// Route to render the filtered villagers page
app.get('/filteredVillagers', async (req, res) => {
  checkSessionStatus(req, res);
  // Fetch data for the furniture menu & villager traits
  const { concepts, series, sets } = await fetchFurnitureMenu();
  const { speciesList, personalities, signs } = await fetchVillagerTraits();

  // Extract the query parameters from the URL
  const species = req.query.species;
  const personality = req.query.personality;
  const sign = req.query.sign;

  let response = await fetch(base_url + endpoint, { headers });
  let data = await response.json();

  // Filter the data based on the selected options
  let filteredVillagers = data.filter((villager) => {
    if (species && villager.species !== species) return false;
    if (personality && villager.personality !== personality) return false;
    if (sign && villager.sign !== sign) return false;
    return true;
  });

  let page = parseInt(req.query.page) || 1;

  // Determines how many pages to create
  let totalVillagers = filteredVillagers.length;
  let totalPages = Math.ceil(totalVillagers / villagers_per_page);
  let indexStart = (page - 1) * villagers_per_page;
  let indexEnd = indexStart + villagers_per_page;
  let paginatedVillagers = filteredVillagers.slice(indexStart, indexEnd);

  // Render all filtered Villager information
  res.render('filteredVillagers', {
    villagers: paginatedVillagers.map(villager => {
      return {
        imageUrl: villager.image_url,
        name: villager.name,
        species: villager.species,
        personality: villager.personality,
        sign: villager.sign,
        quote: villager.quote,
        phrase: villager.phrase
      };
    }),
    currentPage: page, totalPages: totalPages,
    concepts, series, sets,
    speciesList, personalities, signs,
    species: species,
    personality: personality,
    sign: sign,
  });
});

app.get('/cart', async (req, res) => {
  checkSessionStatus(req, res);
  // Fetch data for the furniture menu
  const { concepts, series, sets } = await fetchFurnitureMenu();

  // Check if the user is logged in
  if (req.session.authenticated) {
    // Retrieve the cart array from the user's session
    const cart = req.session.user.cart || [];
    res.render('cart', { cart, concepts, series, sets });
  } else {
    // User is not logged in, show an empty cart
    res.render('cart', { cart: [], concepts, series, sets });
  }
});

app.post('/addToCart', async (req, res) => {
  checkSessionStatus(req, res);
  // If user is not logged in, redirect to login page
  if (!req.session.authenticated) {
    return res.redirect('/login');
  }

  const newItem = req.body;
  // Access the cart of the user
  const cart = req.session.user.cart || [];

  // Check if item is already in cart
  const existingItem = cart.find(item => item.sku === newItem.sku);

  // Increase quantity of item in cart
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    newItem.quantity = 1;
    cart.push(newItem);
  }

  // Save the updated cart to the session
  req.session.user.cart = cart;
  return res.json({ message: 'Item added to your cart!' });
});

app.post('/updateQuantity', (req, res) => {
  checkSessionStatus(req, res);
  const { sku, quantity } = req.body;

  // Find the item with the matching sku
  const itemToUpdate = req.session.user.cart.find(item => item.sku === sku);
  // Update the quantity
  itemToUpdate.quantity = parseInt(quantity);
  // Saves the session cart
  req.session.save();
});

app.post('/removeFromCart', (req, res) => {
  checkSessionStatus(req, res);
  const { sku } = req.body;

  // Get the index of the item with the matching sku
  const itemIndex = req.session.user.cart.findIndex(item => item.sku === sku);

  // Remove the item from the cart
  if (itemIndex !== -1) {
    req.session.user.cart.splice(itemIndex, 1);
    return res.json({ message: 'Item removed from your cart!' });
  }
});

app.post('/cartCheckout', async (req, res) => {
  
  const userId = req.session.user.userID;
  const cart = req.session.user.cart;
  const taxRate = 0.0775;

  // Total cost calculation
  let total = 0;
  for (const item of cart) {
    total += item.price * item.quantity;
  }
  total += total * taxRate;

  // Subtotal calculation
  let subtotal = 0;
  for (const item of cart) {
    subtotal += item.price * item.quantity;
  }

  // Tax calculation
  let tax = 0;
  tax = subtotal * taxRate;

  // Get the current date for the order
  const date = new Date();

  // Insert data into the orders table
  let insertOrderSQL = `INSERT INTO orders (date, subtotal, tax, total, userId) VALUES (?, ?, ?, ?, ?)`;
  let insertOrderParams = [date, subtotal, tax, total, userId];
  const result = await executeSQL(insertOrderSQL, insertOrderParams);

  // Get the orderId
  const orderId = result.insertId;

  // Insert data into the items table
  for (const item of cart) {
    let insertItemSQL = `INSERT INTO items (SKU, name, price, qty, orderId) VALUES (?, ?, ?, ?, ?)`;
    let insertItemParams = [item.sku, item.name, item.price, item.quantity, orderId];
    await executeSQL(insertItemSQL, insertItemParams);
  }

  // Clear the cart after checkout
  req.session.user.cart = [];
  res.json({ message: 'Checkout successful!' });
});

// Route to handle logout by user
app.get('/logout', (req, res) => {
  checkSessionStatus(req, res);

  // Destroy session
  // req.session.destroy();

  // Remove authentication and user info
  req.session.authenticated = false;
  req.session.user = {
    userID: null,
    username: null,
    password: null,
    villager: null,
    villagerImage: null,
    subscribe: null
  };

  // Redirect the user to the homepage
  return res.redirect('/');
});

app.get('/orderHistory', async (req, res) => {
  checkSessionStatus(req, res);
  // Fetch data for the furniture menu
  const { concepts, series, sets } = await fetchFurnitureMenu();
  let userID = req.session.user.userID;
  let sql = `SELECT orderID, date, total FROM orders WHERE userID=${userID} ORDER BY date DESC`;
  let orders = await executeSQL(sql);
  let formattedOrders = [];

  //check to see if orders exist
  if (typeof orders[0] === 'undefined') {
    res.render('orderHistory', { "orderError": true, formattedOrders, concepts, series, sets });
  } else {

    // Format orders
    formattedOrders = orders.map(order => {
      return {
        ...order,
        date: new Date(order.date).toLocaleDateString(),
        total: (parseFloat(order.total)).toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
        }),
      };
    });

    // Fetch items for each order and add them to the formattedOrders array
    const itemsByOrder = await getItemsForOrders(orders);
    formattedOrders.forEach(order => {
      order.items = itemsByOrder[order.orderID] || [];
    });
    res.render('orderHistory', { formattedOrders, concepts, series, sets });
  }
});

// Database test
app.get("/dbTest", async function(req, res) {
  let sql = "SELECT CURDATE()";
  let rows = await executeSQL(sql);
  res.send(rows);
});

// Execute SQL
async function executeSQL(sql, params) {
  return new Promise(function(resolve, reject) {
    pool.query(sql, params, function(err, rows, fields) {
      if (err) throw err;
      resolve(rows);
    });
  });
}

// Start server
app.listen(3000, () => {
  console.log("Expresss server running...")
});