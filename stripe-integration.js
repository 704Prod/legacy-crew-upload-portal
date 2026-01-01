// STRIPE INTEGRATION - Embedded Payment Element
// Replace with your actual Stripe publishable key
const AZURE_FUNCTION_URL = 'https://legacy-crew-upload-v2-e8h4akc0brdsh5hd.westcentralus-01.azurewebsites.net/api/FileUpload';
const STRIPE_PUBLIC_KEY = 'pk_test_51SkFbsKyMVZiJynmWUtyBbZTWDQ8cASQCdv1Y2PmMIniONV3lTAHYQ3qJLgTbbLIVOwRjHKK1tSF1gHSPoJ1fjcJ00XK5IzuEP'; // CHANGE THIS!
const stripe = Stripe(STRIPE_PUBLIC_KEY);

// Payment Intent endpoint (add to your Azure Functions)
const PAYMENT_ENDPOINT = 'https://legacy-crew-upload-v2-e8h4akc0brdsh5hd.westcentralus-01.azurewebsites.net/api/createpaymentintent';
const CONFIRM_PAYMENT_ENDPOINT = 'https://legacy-crew-upload-v2-e8h4akc0brdsh5hd.westcentralus-01.azurewebsites.net/api/confirm-payment';

let elements;
let paymentIntentClientSecret;
let filesFormData; // Store files temporarily

// Show payment section after file validation
async function showPaymentSection() {
  // Validate form first
  if (!validateForm()) {
    alert('Please fill in all required fields');
    return;
  }
  
  // Store files in memory
  storeFilesForUpload();
  
  // Hide upload form, show payment
  document.getElementById('formFields').style.display = 'none';
  document.getElementById('paymentSection').style.display = 'block';
  
  // Update order summary
  updateOrderSummary();
  
  // Initialize Stripe payment
  await initializePayment();
  
  // Scroll to payment section
  document.getElementById('paymentSection').scrollIntoView({ behavior: 'smooth' });
}

// Store all files in FormData for later upload
function storeFilesForUpload() {
  filesFormData = new FormData();
  
  // Add form fields
  filesFormData.append('serviceType', selectedService);
  filesFormData.append('artistName', document.getElementById('artistName').value);
  filesFormData.append('email', document.getElementById('email').value);
  filesFormData.append('phone', document.getElementById('phone').value);
  filesFormData.append('songTitle', document.getElementById('songTitle').value);
  filesFormData.append('bpm', document.getElementById('bpm').value || 'Not specified');
  filesFormData.append('key', document.getElementById('key').value || 'Not specified');
  filesFormData.append('notes', document.getElementById('notes').value || 'None');
  
  // Add all files from categories
  Object.keys(FILE_CATEGORIES).forEach(key => {
    const category = FILE_CATEGORIES[key];
    category.files.forEach(file => {
      filesFormData.append('files', file);
    });
  });
  
  // Calculate and add pricing
  const total = calculateTotal();
  filesFormData.append('totalPrice', total.toFixed(2));
}

// Calculate total price
function calculateTotal() {
  const basePrice = SERVICE_PRICING[selectedService];
  const extraCost = totalFileCount > 10 ? (totalFileCount - 10) * 0.50 : 0;
  return basePrice + extraCost;
}

// Update order summary display
function updateOrderSummary() {
  const basePrice = SERVICE_PRICING[selectedService];
  const extraCost = totalFileCount > 10 ? (totalFileCount - 10) * 0.50 : 0;
  const total = basePrice + extraCost;
  
  document.getElementById('summaryService').textContent = selectedService;
  document.getElementById('summarySong').textContent = document.getElementById('songTitle').value;
  document.getElementById('summaryArtist').textContent = document.getElementById('artistName').value;
  document.getElementById('summaryFiles').textContent = `${totalFileCount} files`;
  
  // Base price
  document.querySelector('#basePrice span:last-child').textContent = `$${basePrice.toFixed(2)}`;
  
  // Extra files
  if (extraCost > 0) {
    document.getElementById('extraFilesLine').style.display = 'flex';
    document.querySelector('#extraFilesLine span:last-child').textContent = `$${extraCost.toFixed(2)}`;
  }
  
  // Total
  document.getElementById('summaryTotal').textContent = `$${total.toFixed(2)}`;
}

// Initialize Stripe Payment Element
async function initializePayment() {
  try {
    // Show loading state
    setLoading(true);
    
    const total = calculateTotal();
    
    // Create Payment Intent via your Azure Function
    const response = await fetch(PAYMENT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(total * 100), // Convert to cents
        currency: 'usd',
        description: `${selectedService} - ${document.getElementById('songTitle').value}`,
        metadata: {
          service: selectedService,
          songTitle: document.getElementById('songTitle').value,
          artistName: document.getElementById('artistName').value,
          email: document.getElementById('email').value
        }
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create payment intent');
    }
    
    const { clientSecret } = await response.json();
    paymentIntentClientSecret = clientSecret;
    
    // Create Stripe Elements
    const appearance = {
      theme: 'night',
      variables: {
        colorPrimary: '#ff0000',
        colorBackground: '#0a0a0a',
        colorSurface: '#1a1a1a',
        colorText: '#ffffff',
        colorDanger: '#ff0000',
        fontFamily: 'Inter, sans-serif',
        borderRadius: '2px'
      }
    };
    
    elements = stripe.elements({ appearance, clientSecret });
    
    // Create and mount Payment Element
    const paymentElement = elements.create('payment');
    paymentElement.mount('#payment-element');
    
    // Enable submit button when terms are checked
    document.getElementById('termsCheckbox').addEventListener('change', function() {
      document.getElementById('submitPaymentButton').disabled = !this.checked;
    });
    
  } catch (error) {
    console.error('Payment initialization error:', error);
    showMessage('Failed to initialize payment. Please try again.');
  } finally {
    setLoading(false);
  }
}

// Handle payment submission
document.addEventListener('DOMContentLoaded', function() {
  const paymentForm = document.getElementById('submitPaymentButton');
  if (paymentForm) {
    paymentForm.addEventListener('click', handlePaymentSubmit);
  }
});

async function handlePaymentSubmit(e) {
  e.preventDefault();
  
  if (!document.getElementById('termsCheckbox').checked) {
    showMessage('Please accept the terms of service');
    return;
  }
  
  setLoading(true);
  
  // Confirm payment with Stripe
  const { error, paymentIntent } = await stripe.confirmPayment({
    elements,
    confirmParams: {
      return_url: window.location.href, // Not used in our flow
      receipt_email: document.getElementById('email').value,
    },
    redirect: 'if_required' // Important: prevents automatic redirect
  });
  
  if (error) {
    // Show error to customer
    if (error.type === "card_error" || error.type === "validation_error") {
      showMessage(error.message);
    } else {
      showMessage("An unexpected error occurred. Please try again.");
    }
    setLoading(false);
    return;
  }
  
  // Payment succeeded!
  if (paymentIntent.status === 'succeeded') {
    await handlePaymentSuccess(paymentIntent);
  }
}

// Handle successful payment
async function handlePaymentSuccess(paymentIntent) {
  // Hide payment section
  document.getElementById('paymentSection').style.display = 'none';
  
  // Show processing
  document.getElementById('processingSection').style.display = 'block';
  
  try {
    // Add payment info to form data
    filesFormData.append('paymentIntentId', paymentIntent.id);
    filesFormData.append('paymentStatus', 'paid');
    
    // Upload files to Azure
    const uploadResponse = await fetch(AZURE_FUNCTION_URL, {
      method: 'POST',
      body: filesFormData
    });
    
    if (!uploadResponse.ok) {
      throw new Error('File upload failed');
    }
    
    // Show success
    document.getElementById('processingSection').style.display = 'none';
    document.getElementById('successSection').style.display = 'block';
    document.getElementById('orderId').textContent = paymentIntent.id.slice(-8).toUpperCase();
    
    // Simulate upload progress
    let progress = 0;
    const progressBar = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadPercentage');
    
    const progressInterval = setInterval(() => {
      progress += 10;
      progressBar.style.width = progress + '%';
      progressText.textContent = progress + '%';
      
      if (progress >= 100) {
        clearInterval(progressInterval);
        
        // Store order info for thank you page
        sessionStorage.setItem('orderStatus', 'Queued');
        sessionStorage.setItem('orderService', selectedService);
        sessionStorage.setItem('orderPrice', calculateTotal().toFixed(2));
        sessionStorage.setItem('songTitle', document.getElementById('songTitle').value);
        sessionStorage.setItem('paymentId', paymentIntent.id);
        
        // Redirect after 3 seconds
        setTimeout(() => {
          window.location.href = 'thankyou.html';
        }, 3000);
      }
    }, 300);
    
  } catch (error) {
    console.error('Upload error:', error);
    document.getElementById('processingSection').style.display = 'none';
    showMessage('Payment successful but file upload failed. Please contact support with Order ID: ' + paymentIntent.id.slice(-8).toUpperCase());
  }
}

// Go back to files section
function backToFiles() {
  document.getElementById('paymentSection').style.display = 'none';
  document.getElementById('formFields').style.display = 'block';
  document.getElementById('formFields').scrollIntoView({ behavior: 'smooth' });
}

// Show messages
function showMessage(messageText) {
  const messageContainer = document.querySelector("#payment-message");
  messageContainer.textContent = messageText;
  messageContainer.style.display = 'block';
  
  setTimeout(() => {
    messageContainer.style.display = 'none';
  }, 5000);
}

// Toggle loading state
function setLoading(isLoading) {
  const submitButton = document.querySelector("#submitPaymentButton");
  const spinner = document.querySelector("#spinner");
  const buttonText = document.querySelector("#button-text");
  
  if (isLoading) {
    submitButton.disabled = true;
    spinner.style.display = 'inline-block';
    buttonText.textContent = 'Processing...';
  } else {
    submitButton.disabled = !document.getElementById('termsCheckbox').checked;
    spinner.style.display = 'none';
    buttonText.textContent = 'Pay Now';
  }
}

// Validate form before payment
function validateForm() {
  const required = [
    'artistName',
    'email', 
    'phone',
    'songTitle'
  ];
  
  for (let field of required) {
    if (!document.getElementById(field).value) {
      return false;
    }
  }
  
  // Check for required files
  if (selectedService === 'Mixing') {
    if (currentMode === 'basic') {
      return FILE_CATEGORIES.vocals.files.length > 0 && 
             FILE_CATEGORIES.instrumental.files.length > 0;
    }
  } else {
    return FILE_CATEGORIES.master.files.length > 0;
  }
  
  return true;
}
