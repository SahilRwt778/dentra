type PayuCallbackResult = {
  transactionId: string;
  successful: boolean;
};

/** Close native checkout after the controller verifies the PayU response. */
export function payuCallbackPage(result: PayuCallbackResult): string {
  const method = result.successful ? 'onSuccess' : 'onFailure';
  // Send only a minimal, form-encoded result to the SDK, never raw callback fields or card data.
  const response = JSON.stringify(
    new URLSearchParams({
      txnid: result.transactionId,
      status: result.successful ? 'success' : 'failure',
    }).toString(),
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Return to Dentra</title>
</head>
<body>
  <h2>Returning to Dentra</h2>
  <p>Your payment result has been received. Dentra will refresh your appointment's payment status.</p>
  <p>If checkout does not close automatically, use the back arrow to return to your appointment.</p>
  <script>
    var callbackSent = false;

    // Legacy iOS WebViews invoke this function after loading the merchant page.
    function payu_merchant_js_callback() {
      if (callbackSent) return;
      var response = ${response};
      var handlers = window.webkit && window.webkit.messageHandlers;
      var observer = handlers && handlers.observe;

      if (observer && typeof observer.postMessage === 'function') {
        callbackSent = true;
        observer.postMessage({ ${method}: JSON.stringify({ response: response }) });
      } else if (window.PayU && typeof window.PayU.${method} === 'function') {
        callbackSent = true;
        window.PayU.${method}(response);
      }
    }

    payu_merchant_js_callback();
  </script>
</body>
</html>`;
}
