import { runInNewContext } from 'node:vm';
import { payuCallbackPage } from './payu-callback-page';

const transactionId = '0123456789abcdef01234567';

function pageScript(successful: boolean, id = transactionId) {
  const html = payuCallbackPage({ transactionId: id, successful });
  return html.match(/<script>([\s\S]*?)<\/script>/)![1];
}

test.each([true, false])('Android finishes checkout for success=%s', successful => {
  const onSuccess = jest.fn();
  const onFailure = jest.fn();
  const context = { window: { PayU: { onSuccess, onFailure } } };
  runInNewContext(pageScript(successful), context);

  const selected = successful ? onSuccess : onFailure;
  const other = successful ? onFailure : onSuccess;
  expect(selected).toHaveBeenCalledTimes(1);
  expect(Object.fromEntries(new URLSearchParams(selected.mock.calls[0][0])))
    .toEqual({ txnid: transactionId, status: successful ? 'success' : 'failure' });
  expect(other).not.toHaveBeenCalled();

  // A second WebView callback must not emit a duplicate result.
  runInNewContext('payu_merchant_js_callback()', context);
  expect(selected).toHaveBeenCalledTimes(1);
});

test.each([true, false])('iOS WKWebView finishes checkout for success=%s', successful => {
  const postMessage = jest.fn();
  runInNewContext(pageScript(successful), {
    window: { webkit: { messageHandlers: { observe: { postMessage } } } },
  });

  expect(postMessage).toHaveBeenCalledTimes(1);
  const event = postMessage.mock.calls[0][0];
  const method = successful ? 'onSuccess' : 'onFailure';
  expect(Object.keys(event)).toEqual([method]);
  const response = JSON.parse(event[method]).response;
  expect(Object.fromEntries(new URLSearchParams(response)))
    .toEqual({ txnid: transactionId, status: successful ? 'success' : 'failure' });
});

test('a legacy iOS WebView can invoke its callback after injecting the bridge', () => {
  const onSuccess = jest.fn();
  const context: { window: { PayU?: { onSuccess: typeof onSuccess } } } = { window: {} };
  runInNewContext(pageScript(true), context);
  context.window.PayU = { onSuccess };
  runInNewContext('payu_merchant_js_callback()', context);
  expect(onSuccess).toHaveBeenCalledTimes(1);
});

test('callback values cannot break out of the page script', () => {
  const id = '</script><script>throw new Error("injected")</script>\u2028';
  const html = payuCallbackPage({ transactionId: id, successful: true });
  expect(html.match(/<script>/g)).toHaveLength(1);
  const onSuccess = jest.fn();
  runInNewContext(pageScript(true, id), { window: { PayU: { onSuccess } } });
  expect(new URLSearchParams(onSuccess.mock.calls[0][0]).get('txnid')).toBe(id);
});
