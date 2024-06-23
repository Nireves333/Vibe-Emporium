const cart = document.querySelector('.container-cart');

const addBtn = document.querySelectorAll('.add-btn');
addBtn.forEach(button => {
  button.addEventListener('click', () => {
    handleAddToCartClick(button);
  });
});

const removeBtn = document.querySelectorAll('.remove-btn');
removeBtn.forEach(button => {
  button.addEventListener('click', handleRemoveClick);
});

const checkoutBtn = document.querySelector('.checkout-btn');
if(checkoutBtn) {
  checkoutBtn.addEventListener('click', handleCheckoutClick);
}


// Function to handle Add to Cart button
async function handleAddToCartClick(button) {
  const itemImg = button.dataset.img;
  const itemSku = button.dataset.sku;
  const itemName = button.dataset.name;
  const itemPrice = button.dataset.price;

  try {
    // POST request to the server to add an item
    const response = await fetch('/addToCart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        img: itemImg,
        sku: itemSku,
        name: itemName,
        price: itemPrice,
      }),
    });
    // Check if the response is a redirect
    if (response.redirected) {
      // Redirecting to the login page
      window.location.href = response.url;
    } else {
      // Parsing response JSON data
      const data = await response.json();
      if (data) {
        // Show popup message
        showPopup(data.message);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Event listener for quantity buttons in cart
if (cart) {
  cart.addEventListener('click', function (event) {
    if (event.target.classList.contains('incBtn') 
        || event.target.classList.contains('decBtn')) {
      const targetId = event.target.dataset.target;
      const input = document.getElementById(targetId);
      const price = input.dataset.price;
      const sku = input.dataset.sku;
      // Parse user input as an integer
      let value = parseInt(input.value);
      // Increment or decrement based on the button clicked
      if (event.target.classList.contains('incBtn')) {
        value = Math.min(value + 1, 99);
      } else if (event.target.classList.contains('decBtn')) {
        value = Math.max(value - 1, 1);
      }
      // Update values, quantity, and totals
      input.value = value;
      updateCartQuantity(input);
      updateItemSubtotal(value, price, sku);
    }
  }); 
}

// Function to handle quantity updates
function updateCartQuantity(input) {
  const sku = input.dataset.sku;
  const newQuantity = input.value;

  // POST request to the server
  fetch('/updateQuantity', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sku: sku, quantity: newQuantity }),
  })
    .then((response) => response.json())
    .catch((error) => {
      console.error('Error:', error);
    });
}

// Function to calculate and update subtotals for each item
function updateItemSubtotal(quantity, price, sku) {
  const subtotalItem = document.getElementById('subtotalItem' + sku);
  // Calculate and update the subtotal
  const subtotal = quantity * price;
  subtotalItem.textContent = `${subtotal.toFixed(2)}`;
  // Update cart totals
  updateTotals();
}

// Function to calculate and update cart totals
if (cart) {
  function updateTotals() {
    const itemTotals = document.querySelectorAll('[id^="subtotalItem"]');
    const taxRate = 0.0775;
    let subtotal = 0;
    // Calculate subtotal
    itemTotals.forEach(itemTotal => {
      subtotal += parseFloat(itemTotal.textContent);
    });
    // Calculate tax
    const tax = subtotal * taxRate;
    // Calculate total
    const total = subtotal + tax;
    // Update values
    document.getElementById('subtotal').textContent = `${subtotal.toFixed(2)}`;
    document.getElementById('tax').textContent = `${tax.toFixed(2)}`;
    document.getElementById('total').textContent = `${total.toFixed(2)}`;
  }
  updateTotals();
}

// Function to handle Remove button
function handleRemoveClick(event) {
  const sku = event.target.dataset.sku;

  // POST request to the server to remove the item
  fetch('/removeFromCart', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sku: sku }),
  })
    .then((response) => response.json())
    .then((data) => {
      window.location.reload();
      // Show popup message
      showPopup(data.message);
    })
    .catch((error) => {
      console.error('Error:', error);
    });
}

// Function to handle Checkout button
function handleCheckoutClick() {
  // POST request to the server
  fetch('/cartCheckout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then((response) => response.json())
    .then((data) => {
      window.location.reload();
      // Show popup message
      showPopup(data.message);
    })
    .catch((error) => {
      console.error('Error:', error);
    });
}

// Function to show popup
function showPopup(message) {
  // Get and set popup message
  const popup = document.getElementById('custom-popup');
  popup.innerHTML = `<img src="/assets/icon_alert.png" alt="Alert Icon" width="30" height="30" style="margin-right: 10px;"> ${message} <button type="button" class="btn-close" style="margin-left: 40px;"></button>`;

  // Display popup
  popup.style.display = 'block';
  
  // Close button functionality
  const closeButton = popup.querySelector('.btn-close');
  closeButton.addEventListener('click', () => {
    popup.style.display = 'none';
  });
}

function closeBtn() {
  const popup = document.querySelector('.popup-valid');
  popup.style.display = 'none';
}
