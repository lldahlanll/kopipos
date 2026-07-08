export const loadMidtransSnap = (clientKey, isProduction) => {
  if (!clientKey || clientKey.startsWith("SB-Mid-client-YOUR_")) return;
  
  const scriptId = 'midtrans-snap-script';
  const existingScript = document.getElementById(scriptId);
  
  const src = isProduction
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';
    
  if (existingScript) {
    if (existingScript.getAttribute('data-client-key') === clientKey && existingScript.src === src) {
      return; // Already loaded correctly
    }
    existingScript.remove(); // Remove to reload with correct key/source
  }
  
  const script = document.createElement('script');
  script.id = scriptId;
  script.src = src;
  script.setAttribute('data-client-key', clientKey);
  script.async = true;
  document.head.appendChild(script);
};
